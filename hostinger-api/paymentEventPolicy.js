import { pool } from "./db.js";

let schemaPromise;

export async function ensurePaymentEventLogTable() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS payment_event_log (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(191) NOT NULL,
        order_number VARCHAR(32) NOT NULL,
        gateway_order_id VARCHAR(64) NOT NULL,
        gateway_payment_id VARCHAR(64) NOT NULL,
        amount_paise BIGINT UNSIGNED NOT NULL,
        currency CHAR(3) NOT NULL,
        event_type VARCHAR(80) NOT NULL,
        event_status VARCHAR(80) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_payment_event_gateway_payment (gateway_payment_id),
        KEY idx_payment_event_order (order_id, created_at),
        KEY idx_payment_event_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

export function buildPaymentEventRecord(event) {
  const record = {
    orderId: String(event?.orderId || "").trim(),
    orderNumber: String(event?.orderNumber || "").trim(),
    gatewayOrderId: String(event?.gatewayOrderId || "").trim(),
    gatewayPaymentId: String(event?.gatewayPaymentId || "").trim(),
    amountPaise: Number(event?.amountPaise),
    currency: String(event?.currency || "").trim().toUpperCase(),
    eventType: String(event?.eventType || "").trim(),
    eventStatus: String(event?.eventStatus || "").trim()
  };

  if (!record.orderId || !/^SAR-\d{6}$/.test(record.orderNumber)) {
    throw new Error("A valid SARINE order reference is required for a payment event.");
  }
  if (!record.gatewayOrderId || !/^order_[A-Za-z0-9]+$/.test(record.gatewayOrderId)) {
    throw new Error("A valid gateway order ID is required for a payment event.");
  }
  if (!record.gatewayPaymentId || !/^pay_[A-Za-z0-9]+$/.test(record.gatewayPaymentId)) {
    throw new Error("A valid gateway payment ID is required for a payment event.");
  }
  if (!Number.isSafeInteger(record.amountPaise) || record.amountPaise <= 0) {
    throw new Error("Payment event amount must be a positive integer in paise.");
  }
  if (record.currency !== "INR") {
    throw new Error("Only INR payment events are supported.");
  }
  if (!record.eventType || record.eventType.length > 80 || !record.eventStatus || record.eventStatus.length > 80) {
    throw new Error("Payment event type and status are required.");
  }
  return record;
}

/**
 * Append one immutable record per captured gateway payment.
 * The gateway payment ID is globally unique; a replay for the same SARINE
 * order is harmless, while reuse against another order is rejected.
 */
export async function recordVerifiedPaymentEvent(connection, event) {
  const record = buildPaymentEventRecord(event);
  const [existingRows] = await connection.execute(
    "SELECT order_id, order_number, gateway_order_id, gateway_payment_id, amount_paise, currency, event_type, event_status FROM payment_event_log WHERE gateway_payment_id = ? FOR UPDATE",
    [record.gatewayPaymentId]
  );
  if (existingRows.length) {
    const existing = existingRows[0];
    if (
      String(existing.order_id) !== record.orderId ||
      existing.order_number !== record.orderNumber ||
      existing.gateway_order_id !== record.gatewayOrderId ||
      Number(existing.amount_paise) !== record.amountPaise ||
      existing.currency !== record.currency
    ) {
      throw new Error("This gateway payment is already recorded against a different payment context.");
    }
    return { inserted: false, event: existing };
  }

  await connection.execute(
    `INSERT INTO payment_event_log
     (order_id, order_number, gateway_order_id, gateway_payment_id, amount_paise, currency, event_type, event_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE gateway_payment_id = VALUES(gateway_payment_id)`,
    [
      record.orderId, record.orderNumber, record.gatewayOrderId,
      record.gatewayPaymentId, record.amountPaise, record.currency,
      record.eventType, record.eventStatus
    ]
  );

  const [rows] = await connection.execute(
    "SELECT order_id, order_number, gateway_order_id, gateway_payment_id, amount_paise, currency, event_type, event_status FROM payment_event_log WHERE gateway_payment_id = ? FOR UPDATE",
    [record.gatewayPaymentId]
  );
  const saved = rows[0];
  if (!saved ||
      String(saved.order_id) !== record.orderId ||
      saved.order_number !== record.orderNumber ||
      saved.gateway_order_id !== record.gatewayOrderId ||
      Number(saved.amount_paise) !== record.amountPaise ||
      saved.currency !== record.currency) {
    throw new Error("Gateway payment event could not be safely associated with this order.");
  }
  return { inserted: true, event: saved };
}
