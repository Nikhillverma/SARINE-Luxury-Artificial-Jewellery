import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { buildRefundRequest, buildRefundGatewayRequest, normalizeGatewayRefundStatus, calculateRefundableBalance } from "./refundPolicy.js";
import { ensureRefundLedgerSchema, refreshOrderRefundFlag } from "./refundLedger.js";

const router = Router();
router.use(requireAdminAuth);

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay API credentials are not configured.");
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function fetchCapturedPayment(paymentId) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${credentials()}`, Accept: "application/json" }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Razorpay could not verify the selected payment.");
  if (data.id !== paymentId || data.status !== "captured" || data.currency !== "INR") {
    throw new Error("Only a captured INR Razorpay payment can be refunded.");
  }
  return data;
}

async function submitRefund(record) {
  const body = buildRefundGatewayRequest({
    amountPaise: Number(record.amount_paise),
    idempotencyKey: record.idempotency_key,
    orderNumber: record.order_number,
    reason: record.reason
  });
  let response;
  let data;
  try {
    response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(record.gateway_payment_id)}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Refund-Idempotency": record.idempotency_key
      },
      body: JSON.stringify(body)
    });
    data = await response.json().catch(() => ({}));
  } catch (error) {
    return { status: "unknown", error: "Gateway response was not received. Retry only with the saved idempotency key." };
  }

  if (!response.ok) {
    if (response.status === 409 || response.status >= 500) {
      return { status: "unknown", error: "Gateway outcome is not yet confirmed. The same idempotency key is retained for safe retry." };
    }
    return { status: "failed", error: String(data?.error?.description || "Razorpay rejected the refund request.").slice(0, 1000) };
  }

  const status = normalizeGatewayRefundStatus(data.status);
  if (!/^rfnd_[A-Za-z0-9]+$/.test(String(data.id || "")) ||
      data.payment_id !== record.gateway_payment_id ||
      Number(data.amount) !== Number(record.amount_paise) ||
      data.currency !== "INR" ||
      status === "unknown") {
    return { status: "unknown", error: "Razorpay response did not match the saved refund request. Manual reconciliation is required." };
  }
  return { status, gatewayRefundId: data.id, gatewayStatus: data.status, error: null };
}

async function saveGatewayOutcome(recordId, outcome) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM razorpay_refund_records WHERE id = ? FOR UPDATE", [recordId]);
    if (!rows.length) throw new Error("Saved refund request could not be found.");
    const record = rows[0];
    if (record.status !== "processed" && record.status !== "failed") {
      await connection.execute(
        `UPDATE razorpay_refund_records
         SET gateway_refund_id = COALESCE(?, gateway_refund_id),
             status = ?, gateway_status = ?, error_message = ?,
             processed_at = CASE WHEN ? = 'processed' THEN UTC_TIMESTAMP(3) ELSE processed_at END,
             updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [outcome.gatewayRefundId || null, outcome.status, outcome.gatewayStatus || null,
          outcome.error || null, outcome.status, recordId]
      );
      if (outcome.status === "processed") await refreshOrderRefundFlag(connection, record.order_id);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

router.post("/", async (req, res, next) => {
  let connection;
  try {
    const request = buildRefundRequest(req.body);
    await ensureRefundLedgerSchema();

    const [initialRows] = await pool.execute(
      "SELECT * FROM orders WHERE order_number = ? LIMIT 1",
      [request.orderNumber]
    );
    if (!initialRows.length) return res.status(404).json({ error: "SARINE order not found." });
    const initialOrder = initialRows[0];
    if (initialOrder.payment_method !== "online" || initialOrder.payment_status !== "paid" ||
        !(initialOrder.refund_needed || initialOrder.order_status === "needs_refund" || initialOrder.order_status === "cancelled")) {
      return res.status(400).json({ error: "This order is not eligible for a Razorpay refund." });
    }
    if (!initialOrder.razorpay_order_id) return res.status(400).json({ error: "The order has no stored Razorpay order reference." });

    const payment = await fetchCapturedPayment(request.paymentId);
    if (payment.order_id !== initialOrder.razorpay_order_id) {
      return res.status(400).json({ error: "Selected payment does not belong to this SARINE order." });
    }

    const idempotencyKey = crypto.randomUUID();
    const gatewayPayload = buildRefundGatewayRequest({
      amountPaise: request.amountPaise, idempotencyKey,
      orderNumber: request.orderNumber, reason: request.reason
    });
    const receipt = gatewayPayload.receipt;

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orderRows] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? FOR UPDATE", [initialOrder.id]
    );
    if (!orderRows.length) throw new Error("SARINE order no longer exists.");
    const order = orderRows[0];
    if (order.payment_status !== "paid" || order.payment_method !== "online" ||
        !(order.refund_needed || order.order_status === "needs_refund" || order.order_status === "cancelled")) {
      throw new Error("Order refund eligibility changed. Refresh the queue and review it again.");
    }

    const isPrimaryPayment = order.razorpay_payment_id === request.paymentId;
    const [eventRows] = await connection.execute(
      "SELECT gateway_payment_id FROM payment_event_log WHERE gateway_payment_id = ? AND order_id = ? LIMIT 1",
      [request.paymentId, String(order.id)]
    );
    if (!isPrimaryPayment && !eventRows.length) {
      throw new Error("Selected payment is not recorded against this SARINE order.");
    }

    const [balanceRows] = await connection.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'processed' THEN amount_paise ELSE 0 END), 0) AS processed_paise,
         COALESCE(SUM(CASE WHEN status IN ('submitting', 'unknown', 'pending') THEN amount_paise ELSE 0 END), 0) AS reserved_paise
       FROM razorpay_refund_records
       WHERE gateway_payment_id = ?`,
      [request.paymentId]
    );
    const processedPaise = Number(balanceRows[0]?.processed_paise || 0);
    const reservedPaise = Number(balanceRows[0]?.reserved_paise || 0);
    const refundablePaise = calculateRefundableBalance(
      Number(payment.amount),
      Math.max(Number(payment.amount_refunded || 0), processedPaise),
      reservedPaise
    );
    if (request.amountPaise > refundablePaise) {
      throw new Error(`Refund exceeds the remaining captured balance of ₹${(refundablePaise / 100).toFixed(2)}.`);
    }

    const [insert] = await connection.execute(
      `INSERT INTO razorpay_refund_records
       (order_id, order_number, gateway_payment_id, gateway_receipt, idempotency_key,
        amount_paise, currency, status, reason, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, 'INR', 'submitting', ?, ?)`,
      [order.id, order.order_number, request.paymentId, receipt, idempotencyKey,
        request.amountPaise, request.reason, req.admin?.email || "admin"]
    );
    await connection.commit();
    connection.release();
    connection = null;

    const [savedRows] = await pool.execute("SELECT * FROM razorpay_refund_records WHERE id = ? LIMIT 1", [insert.insertId]);
    const outcome = await submitRefund(savedRows[0]);
    await saveGatewayOutcome(insert.insertId, outcome);
    return res.status(outcome.status === "unknown" ? 202 : outcome.status === "failed" ? 502 : 200).json({
      success: outcome.status === "processed" || outcome.status === "pending",
      refundId: insert.insertId,
      gatewayRefundId: outcome.gatewayRefundId || null,
      status: outcome.status,
      message: outcome.error || (outcome.status === "processed"
        ? "Razorpay confirmed the refund as processed."
        : "Refund request accepted by Razorpay and is awaiting final confirmation.")
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    const status = /required|valid|eligible|captured|belong|balance|recorded|changed|exceeds|not found/i.test(error.message) ? 400 : 500;
    return res.status(status).json({ error: error.message || "Refund request could not be completed." });
  }
});

router.post("/:id/retry", async (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid refund request reference." });
    await ensureRefundLedgerSchema();
    const [rows] = await pool.execute("SELECT * FROM razorpay_refund_records WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ error: "Refund request not found." });
    const record = rows[0];
    if (!["unknown", "submitting"].includes(record.status)) {
      return res.status(409).json({ error: "Only an unconfirmed refund request can be retried with its original idempotency key." });
    }
    const outcome = await submitRefund(record);
    await saveGatewayOutcome(id, outcome);
    return res.status(outcome.status === "unknown" ? 202 : outcome.status === "failed" ? 502 : 200).json({
      success: outcome.status === "processed" || outcome.status === "pending",
      refundId: id, gatewayRefundId: outcome.gatewayRefundId || record.gateway_refund_id || null,
      status: outcome.status,
      message: outcome.error || "Razorpay refund status updated."
    });
  } catch (error) {
    console.error("[admin.refunds.retry] Refund retry failed:", error.message);
    return res.status(500).json({ error: "Refund retry could not be completed." });
  }
});

export default router;
