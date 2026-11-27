import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { ensurePaymentEventLogTable } from "./paymentEventPolicy.js";
import { ensureRazorpayWebhookSchema } from "./razorpayWebhookPolicy.js";
import { ensureRefundLedgerSchema } from "./refundLedger.js";
import { classifyWebhookReconciliation } from "./webhookReconciliationPolicy.js";

const router = Router();
router.use(requireAdminAuth);

const RETURN_STATUSES = new Set([
  "pending", "under_review", "approved", "rejected",
  "item_received", "inspection_passed", "inspection_failed",
  "resolved", "closed"
]);

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapReturn(row) {
  return {
    id: Number(row.id),
    orderNumber: row.order_number,
    requestType: row.request_type,
    reason: row.reason,
    notes: row.notes || "",
    status: row.status,
    resolutionNotes: row.resolution_notes || "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    customer: {
      name: row.customer_name || "",
      email: row.customer_email || "",
      phone: row.customer_phone || ""
    },
    order: {
      total: Number(row.total) || 0,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      orderStatus: row.order_status
    }
  };
}

// Read-only queues: customer return/exchange/cancellation requests and orders
// already flagged as requiring a refund. No payment is initiated or marked complete.
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    await ensurePaymentEventLogTable();
    await ensureRazorpayWebhookSchema();
    await ensureRefundLedgerSchema();
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "all";
    const type = typeof req.query.type === "string" ? req.query.type.trim() : "all";
    const limitValue = Number.parseInt(String(req.query.limit || "100"), 10);
    const limit = Math.min(Math.max(Number.isFinite(limitValue) ? limitValue : 100, 1), 100);
    const conditions = [];
    const values = [];

    if (status !== "all") { conditions.push("r.status = ?"); values.push(status); }
    if (type !== "all") { conditions.push("r.request_type = ?"); values.push(type); }
    if (search) {
      const term = "%" + search.toLowerCase() + "%";
      conditions.push("(LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ? OR LOWER(o.customer_email) LIKE ?)");
      values.push(term, term, term);
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const [returnRows] = await pool.execute(
      `SELECT r.id, r.request_type, r.reason, r.notes, r.status, r.resolution_notes,
              r.created_at, r.updated_at, o.order_number, o.customer_name,
              o.customer_email, o.customer_phone, o.total, o.payment_method,
              o.payment_status, o.order_status
       FROM returns r
       INNER JOIN orders o ON o.id = r.order_id
       ${where}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ?`,
      [...values, limit]
    );

    // Synthetic/test orders must never enter the live payment-refund workflow.
    const refundConditions = ["COALESCE(o.is_test, 0) = 0", "(o.refund_needed = 1 OR o.order_status = 'needs_refund' OR EXISTS (SELECT 1 FROM razorpay_refund_records rr WHERE rr.order_id = o.id))"];
    const refundValues = [];
    if (search) {
      const term = "%" + search.toLowerCase() + "%";
      refundConditions.push("(LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ? OR LOWER(o.customer_email) LIKE ?)");
      refundValues.push(term, term, term);
    }
    const [refundRows] = await pool.execute(
      `SELECT o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone,
              o.total, o.refund_amount, o.refund_needed, o.order_status,
              o.payment_method, o.payment_status, o.razorpay_payment_id, o.razorpay_order_id,
              o.razorpay_amount_paise, o.created_at, o.cancelled_at, o.cancellation_reason,
              (SELECT COUNT(*) FROM payment_event_log pe WHERE pe.order_id = o.id) AS payment_event_count,
              (SELECT pe.event_type FROM payment_event_log pe WHERE pe.order_id = o.id
               ORDER BY pe.created_at DESC, pe.id DESC LIMIT 1) AS latest_payment_event,
              (SELECT pe.event_status FROM payment_event_log pe WHERE pe.order_id = o.id
               ORDER BY pe.created_at DESC, pe.id DESC LIMIT 1) AS latest_payment_event_status,
              (SELECT pe.created_at FROM payment_event_log pe WHERE pe.order_id = o.id
               ORDER BY pe.created_at DESC, pe.id DESC LIMIT 1) AS latest_payment_event_at
       FROM orders o
       WHERE ${refundConditions.join(" AND ")}
       ORDER BY COALESCE(o.updated_at, o.created_at) DESC
       LIMIT ?`,
      [...refundValues, limit]
    );

    const refundOrderIds = refundRows.map(row => row.id);
    const refundHistoryByOrder = new Map();
    const capturedPaymentsByOrder = new Map();
    if (refundOrderIds.length) {
      const placeholders = refundOrderIds.map(() => "?").join(",");
      const [historyRows] = await pool.query(
        `SELECT id, order_id, gateway_payment_id, gateway_refund_id, amount_paise,
                status, reason, requested_by, created_at, processed_at, error_message
         FROM razorpay_refund_records
         WHERE order_id IN (${placeholders})
         ORDER BY created_at DESC, id DESC`,
        refundOrderIds.map(String)
      );
      for (const entry of historyRows) {
        const key = String(entry.order_id);
        if (!refundHistoryByOrder.has(key)) refundHistoryByOrder.set(key, []);
        refundHistoryByOrder.get(key).push({
          id: Number(entry.id), paymentId: entry.gateway_payment_id,
          gatewayRefundId: entry.gateway_refund_id || null,
          amountPaise: Number(entry.amount_paise), status: entry.status,
          reason: entry.reason, requestedBy: entry.requested_by,
          createdAt: toIso(entry.created_at), processedAt: toIso(entry.processed_at),
          errorMessage: entry.error_message || null
        });
      }
      const [paymentRows] = await pool.query(
        `SELECT order_id, gateway_payment_id, amount_paise, event_status
         FROM payment_event_log
         WHERE order_id IN (${placeholders})
         ORDER BY created_at ASC, id ASC`,
        refundOrderIds.map(String)
      );
      for (const entry of paymentRows) {
        const key = String(entry.order_id);
        if (!capturedPaymentsByOrder.has(key)) capturedPaymentsByOrder.set(key, []);
        capturedPaymentsByOrder.get(key).push({
          paymentId: entry.gateway_payment_id,
          amountPaise: Number(entry.amount_paise),
          eventStatus: entry.event_status
        });
      }
      const [webhookPaymentRows] = await pool.query(
        `SELECT o.id AS order_id, e.gateway_payment_id, e.amount_paise, e.gateway_status
         FROM razorpay_webhook_events e
         INNER JOIN orders o
           ON o.razorpay_order_id COLLATE utf8mb4_unicode_ci = e.gateway_order_id COLLATE utf8mb4_unicode_ci
         WHERE o.id IN (${placeholders}) AND e.event_type = 'payment.captured'
         ORDER BY e.received_at ASC, e.id ASC`,
        refundOrderIds.map(String)
      );
      for (const entry of webhookPaymentRows) {
        const key = String(entry.order_id);
        if (!capturedPaymentsByOrder.has(key)) capturedPaymentsByOrder.set(key, []);
        const items = capturedPaymentsByOrder.get(key);
        if (!items.some(item => item.paymentId === entry.gateway_payment_id)) {
          items.push({
            paymentId: entry.gateway_payment_id,
            amountPaise: Number(entry.amount_paise),
            eventStatus: `webhook_${entry.gateway_status || "captured"}`
          });
        }
      }
    }

    return res.json({
      returns: returnRows.map(mapReturn),
      refundRequests: refundRows.map(row => ({
        id: String(row.id),
        capturedPayments: (() => {
          const items = capturedPaymentsByOrder.get(String(row.id)) || [];
          if (row.razorpay_payment_id && !items.some(item => item.paymentId === row.razorpay_payment_id)) {
            items.unshift({ paymentId: row.razorpay_payment_id, amountPaise: Number(row.razorpay_amount_paise || Math.round(Number(row.total) * 100)), eventStatus: "primary_payment" });
          }
          return items;
        })(),
        refundHistory: refundHistoryByOrder.get(String(row.id)) || [],
        orderNumber: row.order_number,
        customer: { name: row.customer_name || "", email: row.customer_email || "", phone: row.customer_phone || "" },
        amountRequested: Number(row.refund_amount ?? row.total) || 0,
        refundRequired: Boolean(row.refund_needed || row.order_status === "needs_refund"),
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        orderStatus: row.order_status,
        razorpayPaymentId: row.razorpay_payment_id || null,
        cancellationReason: row.cancellation_reason || "",
        createdAt: toIso(row.created_at),
        cancelledAt: toIso(row.cancelled_at),
        paymentEventCount: Number(row.payment_event_count) || 0,
        latestPaymentEvent: row.latest_payment_event || null,
        latestPaymentEventStatus: row.latest_payment_event_status || null,
        latestPaymentEventAt: toIso(row.latest_payment_event_at)
      }))
    });
  } catch (error) { next(error); }
});

// Read-only reconciliation view for verified Razorpay webhook deliveries.
router.get("/webhook-events", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    await ensurePaymentEventLogTable();
    await ensureRazorpayWebhookSchema();
    await ensureRefundLedgerSchema();
    const limitValue = Number.parseInt(String(req.query.limit || "100"), 10);
    const limit = Math.min(Math.max(Number.isFinite(limitValue) ? limitValue : 100, 1), 200);
    const [rows] = await pool.execute(
      `SELECT e.id, e.event_id, e.event_type, e.gateway_order_id,
              e.gateway_payment_id, e.gateway_refund_id, e.gateway_receipt, e.amount_paise,
              e.currency, e.gateway_status, e.event_status, e.received_at,
              o.order_number, o.payment_status, o.order_status, o.razorpay_payment_id,
              o.total, o.razorpay_amount_paise,
              pe.gateway_payment_id AS ledger_payment_id, pe.amount_paise AS ledger_amount_paise,
              rr.status AS refund_record_status
       FROM razorpay_webhook_events e
       LEFT JOIN orders o
         ON (e.gateway_order_id IS NOT NULL AND o.razorpay_order_id COLLATE utf8mb4_unicode_ci = e.gateway_order_id COLLATE utf8mb4_unicode_ci)
         OR (e.gateway_payment_id IS NOT NULL AND o.razorpay_payment_id COLLATE utf8mb4_unicode_ci = e.gateway_payment_id COLLATE utf8mb4_unicode_ci)
       LEFT JOIN payment_event_log pe ON pe.gateway_payment_id COLLATE utf8mb4_unicode_ci = e.gateway_payment_id COLLATE utf8mb4_unicode_ci
       LEFT JOIN razorpay_refund_records rr
         ON (rr.gateway_refund_id COLLATE utf8mb4_unicode_ci = e.gateway_refund_id COLLATE utf8mb4_unicode_ci AND e.gateway_refund_id IS NOT NULL)
         OR (rr.gateway_receipt COLLATE utf8mb4_unicode_ci = e.gateway_receipt COLLATE utf8mb4_unicode_ci AND e.gateway_receipt IS NOT NULL)
       ORDER BY e.received_at DESC, e.id DESC
       LIMIT ?`,
      [limit]
    );
    const events = rows.map(row => {
      const reconciliationStatus = classifyWebhookReconciliation({
        eventType: row.event_type,
        eventStatus: row.event_status,
        orderFound: Boolean(row.order_number),
        amountMatches: Number(row.amount_paise) === Number(row.razorpay_amount_paise || Math.round(Number(row.total) * 100)),
        orderStatus: row.order_status,
        orderPaymentStatus: row.payment_status,
        orderPaymentId: row.razorpay_payment_id,
        gatewayPaymentId: row.gateway_payment_id,
        paymentLedgerFound: Boolean(row.ledger_payment_id),
        refundRecordStatus: row.refund_record_status
      });
      return {
        id: Number(row.id), eventId: row.event_id, eventType: row.event_type,
        gatewayOrderId: row.gateway_order_id, gatewayPaymentId: row.gateway_payment_id,
        gatewayRefundId: row.gateway_refund_id, gatewayReceipt: row.gateway_receipt || null,
        refundRecordStatus: row.refund_record_status || null, amountPaise: row.amount_paise === null ? null : Number(row.amount_paise),
        currency: row.currency, gatewayStatus: row.gateway_status, eventStatus: row.event_status,
        receivedAt: toIso(row.received_at), orderNumber: row.order_number || null,
        orderPaymentStatus: row.payment_status || null, orderStatus: row.order_status || null,
        reconciliationStatus
      };
    });
    return res.json({ events });
  } catch (error) { next(error); }
});

// Update the review workflow for a return/exchange request only.
// This does not mutate order/payment state or call Razorpay.
router.put("/:id", async (req, res, next) => {
  let connection;
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";
    const resolutionNotes = typeof req.body?.resolutionNotes === "string" ? req.body.resolutionNotes.trim() : "";

    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid return request reference." });
    if (!RETURN_STATUSES.has(status)) return res.status(400).json({ error: "Select a valid request status." });
    if (resolutionNotes.length > 2000) return res.status(400).json({ error: "Resolution notes must be 2,000 characters or fewer." });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT id FROM returns WHERE id = ? FOR UPDATE", [id]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Return request not found." });
    }

    await connection.execute(
      "UPDATE returns SET status = ?, resolution_notes = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [status, resolutionNotes || null, id]
    );
    await connection.commit();
    return res.json({ success: true, id, status, resolutionNotes });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
  }
});

export default router;
