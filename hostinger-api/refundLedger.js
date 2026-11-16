import { pool } from "./db.js";
import { normalizeGatewayRefundStatus } from "./refundPolicy.js";

let schemaPromise;
export async function ensureRefundLedgerSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS razorpay_refund_records (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(191) NOT NULL,
        order_number VARCHAR(32) NOT NULL,
        gateway_payment_id VARCHAR(64) NOT NULL,
        gateway_refund_id VARCHAR(64) NULL,
        gateway_receipt VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(64) NOT NULL,
        amount_paise BIGINT UNSIGNED NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        status VARCHAR(32) NOT NULL,
        reason VARCHAR(500) NOT NULL,
        requested_by VARCHAR(254) NOT NULL,
        gateway_status VARCHAR(40) NULL,
        error_message VARCHAR(1000) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        processed_at DATETIME(3) NULL,
        UNIQUE KEY uq_refund_idempotency (idempotency_key),
        UNIQUE KEY uq_refund_gateway_id (gateway_refund_id),
        UNIQUE KEY uq_refund_receipt (gateway_receipt),
        KEY idx_refund_order (order_id, created_at),
        KEY idx_refund_payment (gateway_payment_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(error => { schemaPromise = undefined; throw error; });
  }
  await schemaPromise;
}

export async function applyGatewayRefundEvent(record) {
  await ensureRefundLedgerSchema();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT * FROM razorpay_refund_records
       WHERE (gateway_refund_id = ? AND ? IS NOT NULL)
          OR (gateway_receipt = ? AND ? IS NOT NULL)
       LIMIT 1 FOR UPDATE`,
      [record.gatewayRefundId, record.gatewayRefundId, record.gatewayReceipt, record.gatewayReceipt]
    );
    if (!rows.length) {
      await connection.commit();
      return { matched: false };
    }
    const refund = rows[0];
    if (refund.gateway_payment_id !== record.gatewayPaymentId ||
        Number(refund.amount_paise) !== Number(record.amountPaise) ||
        (refund.gateway_refund_id && refund.gateway_refund_id !== record.gatewayRefundId)) {
      await connection.rollback();
      return { matched: false, mismatch: true };
    }
    const nextStatus = record.eventType === "refund.failed" ? "failed"
      : record.eventType === "refund.reversed" ? "reversed"
      : record.eventType === "refund.created" ? "pending"
      : record.eventType === "refund.processed" ? normalizeGatewayRefundStatus(record.gatewayStatus)
      : "unknown";
    if (nextStatus === "unknown") {
      await connection.commit();
      return { matched: true, refundId: Number(refund.id), status: "awaiting_verified_status" };
    }
    const terminalStatuses = ["processed", "failed", "reversed"];
    const canApply = !terminalStatuses.includes(refund.status) ||
      (refund.status === "processed" && nextStatus === "reversed");
    if (canApply) {
      await connection.execute(
        `UPDATE razorpay_refund_records
         SET gateway_refund_id = COALESCE(gateway_refund_id, ?),
             status = ?, gateway_status = ?, error_message = NULL,
             processed_at = CASE WHEN ? = 'processed' THEN UTC_TIMESTAMP(3) ELSE processed_at END,
             updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [record.gatewayRefundId, nextStatus, record.gatewayStatus, nextStatus, refund.id]
      );
    }
    if (nextStatus === "processed" || nextStatus === "reversed") {
      await refreshOrderRefundFlag(connection, refund.order_id);
    }
    await connection.commit();
    return { matched: true, refundId: Number(refund.id), status: nextStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function refreshOrderRefundFlag(connection, orderId) {
  const [orders] = await connection.execute(
    "SELECT id, order_number, order_status, refund_amount FROM orders WHERE id = ? FOR UPDATE",
    [orderId]
  );
  if (!orders.length || orders[0].refund_amount === null || orders[0].refund_amount === undefined) return;
  const [rows] = await connection.execute(
    "SELECT COALESCE(SUM(amount_paise), 0) AS processed_paise FROM razorpay_refund_records WHERE order_id = ? AND status = 'processed'",
    [orderId]
  );
  const targetPaise = Math.round(Number(orders[0].refund_amount) * 100);
  const fullyRefunded = Number(rows[0]?.processed_paise || 0) >= targetPaise;
  await connection.execute(
    `UPDATE orders
     SET refund_needed = ?,
         cancelled_at = CASE WHEN ? = 0 AND order_status = 'needs_refund' THEN COALESCE(cancelled_at, UTC_TIMESTAMP(3)) ELSE cancelled_at END,
         order_status = CASE WHEN ? = 0 AND order_status = 'needs_refund' THEN 'cancelled' ELSE order_status END,
         updated_at = UTC_TIMESTAMP(3)
     WHERE id = ?`,
    [fullyRefunded ? 0 : 1, fullyRefunded ? 0 : 1, fullyRefunded ? 0 : 1, orderId]
  );
}
