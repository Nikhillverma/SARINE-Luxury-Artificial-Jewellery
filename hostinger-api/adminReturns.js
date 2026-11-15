import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

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

    const refundConditions = ["(o.refund_needed = 1 OR o.order_status = 'needs_refund')"];
    const refundValues = [];
    if (search) {
      const term = "%" + search.toLowerCase() + "%";
      refundConditions.push("(LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ? OR LOWER(o.customer_email) LIKE ?)");
      refundValues.push(term, term, term);
    }
    const [refundRows] = await pool.execute(
      `SELECT o.order_number, o.customer_name, o.customer_email, o.customer_phone,
              o.total, o.refund_amount, o.refund_needed, o.order_status,
              o.payment_method, o.payment_status, o.razorpay_payment_id,
              o.created_at, o.cancelled_at, o.cancellation_reason,
              (SELECT COUNT(*) FROM payment_events pe WHERE pe.order_id = o.id) AS payment_event_count,
              (SELECT pe.event_type FROM payment_events pe WHERE pe.order_id = o.id
               ORDER BY pe.created_at DESC, pe.id DESC LIMIT 1) AS latest_payment_event,
              (SELECT pe.created_at FROM payment_events pe WHERE pe.order_id = o.id
               ORDER BY pe.created_at DESC, pe.id DESC LIMIT 1) AS latest_payment_event_at
       FROM orders o
       WHERE ${refundConditions.join(" AND ")}
       ORDER BY COALESCE(o.updated_at, o.created_at) DESC
       LIMIT ?`,
      [...refundValues, limit]
    );

    return res.json({
      returns: returnRows.map(mapReturn),
      refundRequests: refundRows.map(row => ({
        orderNumber: row.order_number,
        customer: { name: row.customer_name || "", email: row.customer_email || "", phone: row.customer_phone || "" },
        amountRequested: Number(row.refund_amount ?? row.total) || 0,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        orderStatus: row.order_status,
        razorpayPaymentId: row.razorpay_payment_id || null,
        cancellationReason: row.cancellation_reason || "",
        createdAt: toIso(row.created_at),
        cancelledAt: toIso(row.cancelled_at),
        paymentEventCount: Number(row.payment_event_count) || 0,
        latestPaymentEvent: row.latest_payment_event || null,
        latestPaymentEventAt: toIso(row.latest_payment_event_at)
      }))
    });
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
