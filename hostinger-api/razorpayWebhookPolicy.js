import crypto from "node:crypto";
let schemaPromise;

export async function ensureRazorpayWebhookSchema() {
  const { pool } = await import("./db.js");
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          event_id VARCHAR(128) NOT NULL,
          event_type VARCHAR(80) NOT NULL,
          gateway_order_id VARCHAR(64) NULL,
          gateway_payment_id VARCHAR(64) NULL,
          gateway_refund_id VARCHAR(64) NULL,
          gateway_receipt VARCHAR(100) NULL,
          amount_paise BIGINT UNSIGNED NULL,
          currency CHAR(3) NULL,
          gateway_status VARCHAR(40) NULL,
          event_status VARCHAR(40) NOT NULL DEFAULT 'received',
          received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          processed_at DATETIME(3) NULL,
          UNIQUE KEY uq_razorpay_webhook_event (event_id),
          KEY idx_razorpay_webhook_payment (gateway_payment_id, received_at),
          KEY idx_razorpay_webhook_order (gateway_order_id, received_at),
          KEY idx_razorpay_webhook_status (event_status, received_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'razorpay_webhook_events'
           AND COLUMN_NAME = 'gateway_receipt'`
      );
      if (!columns.length) {
        await pool.query("ALTER TABLE razorpay_webhook_events ADD COLUMN gateway_receipt VARCHAR(100) NULL AFTER gateway_refund_id");
      }
    })().catch(error => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

export function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) return false;
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (typeof secret !== "string" || secret.length === 0) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

export function buildRazorpayWebhookRecord(eventId, payload) {
  const cleanEventId = String(eventId || "").trim();
  const eventType = String(payload?.event || "").trim();
  if (!cleanEventId || cleanEventId.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(cleanEventId)) {
    throw new Error("A valid Razorpay webhook event ID is required.");
  }
  if (!eventType || eventType.length > 80 || !/^[a-z][a-z0-9_.]+$/.test(eventType)) {
    throw new Error("A valid Razorpay webhook event type is required.");
  }
  const payment = payload?.payload?.payment?.entity || null;
  const refund = payload?.payload?.refund?.entity || null;
  const amount = refund?.amount ?? payment?.amount ?? null;
  const record = {
    eventId: cleanEventId,
    eventType,
    gatewayOrderId: String(payment?.order_id || "").trim() || null,
    gatewayPaymentId: String(refund?.payment_id || payment?.id || "").trim() || null,
    gatewayRefundId: String(refund?.id || "").trim() || null,
    gatewayReceipt: String(refund?.receipt || "").trim() || null,
    amountPaise: amount === null || amount === undefined ? null : Number(amount),
    currency: String(refund?.currency || payment?.currency || "").trim().toUpperCase() || null,
    gatewayStatus: String(refund?.status || payment?.status || "").trim() || null
  };
  if (record.gatewayOrderId && !/^order_[A-Za-z0-9]+$/.test(record.gatewayOrderId)) {
    throw new Error("Invalid Razorpay order reference in webhook payload.");
  }
  if (record.gatewayPaymentId && !/^pay_[A-Za-z0-9]+$/.test(record.gatewayPaymentId)) {
    throw new Error("Invalid Razorpay payment reference in webhook payload.");
  }
  if (record.gatewayRefundId && !/^rfnd_[A-Za-z0-9]+$/.test(record.gatewayRefundId)) {
    throw new Error("Invalid Razorpay refund reference in webhook payload.");
  }
  if (record.amountPaise !== null && (!Number.isSafeInteger(record.amountPaise) || record.amountPaise < 0)) {
    throw new Error("Invalid amount in Razorpay webhook payload.");
  }
  if (record.currency && record.currency !== "INR") {
    throw new Error("Unsupported currency in Razorpay webhook payload.");
  }
  return record;
}

export async function storeRazorpayWebhookEvent(record) {
  const { pool } = await import("./db.js");
  await ensureRazorpayWebhookSchema();
  const [result] = await pool.execute(
    `INSERT IGNORE INTO razorpay_webhook_events
     (event_id, event_type, gateway_order_id, gateway_payment_id, gateway_refund_id, gateway_receipt,
      amount_paise, currency, gateway_status, event_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')`,
    [record.eventId, record.eventType, record.gatewayOrderId, record.gatewayPaymentId,
      record.gatewayRefundId, record.gatewayReceipt, record.amountPaise, record.currency, record.gatewayStatus]
  );
  return { inserted: Number(result.affectedRows) === 1 };
}
