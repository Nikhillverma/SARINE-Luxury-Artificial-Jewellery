import Razorpay from "razorpay";
import { matchesOrderRazorpayId } from "./paymentValidation.js";
import { settleCapturedPayment } from "./paymentSettlement.js";

/**
 * Process one verified payment.captured webhook. The event has already been
 * signature-verified and durably inserted by the HTTP receiver.
 * Database settlement and event status are committed in the same transaction.
 */
export async function processCapturedPaymentWebhook({
  record,
  eventId,
  inserted
}, dependencies = {}) {
  const policy = (dependencies.getEventStatus && dependencies.markEventStatus)
    ? null : await import("./razorpayWebhookPolicy.js");
  const getEventStatus = dependencies.getEventStatus || policy.getRazorpayWebhookEventStatus;
  const markEventStatus = dependencies.markEventStatus || policy.markRazorpayWebhookEventStatus;
  const inventory = dependencies.ensureInventoryTable ? null : await import("./inventoryLedger.js");
  const variants = dependencies.ensureProductVariantSchema ? null : await import("./productVariantSchema.js");
  const payments = dependencies.ensurePaymentEventLogTable ? null : await import("./paymentEventPolicy.js");
  const ensureInventory = dependencies.ensureInventoryTable || inventory.ensureInventoryTable;
  const ensureVariants = dependencies.ensureProductVariantSchema || variants.ensureProductVariantSchema;
  const ensurePayments = dependencies.ensurePaymentEventLogTable || payments.ensurePaymentEventLogTable;
  const getConnection = dependencies.getConnection || (async () => {
    const { pool } = await import("./db.js");
    return pool.getConnection();
  });
  const getRazorpay = dependencies.getRazorpay || (() => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) throw new Error("Razorpay API credentials are not configured.");
    return new Razorpay({ key_id, key_secret });
  });
  const matchesOrder = dependencies.matchesOrderRazorpayId || matchesOrderRazorpayId;
  const settle = dependencies.settleCapturedPayment || settleCapturedPayment;

  const currentEventStatus = inserted ? "received" : await getEventStatus(eventId);
  if (currentEventStatus !== "received") {
    return {
      status: 200,
      body: { received: true, duplicate: true, paymentSettlement: currentEventStatus }
    };
  }

  if (!record.gatewayOrderId || !record.gatewayPaymentId ||
      !Number.isSafeInteger(record.amountPaise) || record.amountPaise <= 0) {
    await markEventStatus(eventId, "needs_review");
    return { status: 200, body: { received: true, needsReview: true, reason: "incomplete_payment_reference" } };
  }

  let paymentRecord;
  try {
    paymentRecord = await getRazorpay().payments.fetch(record.gatewayPaymentId);
  } catch (error) {
    // Keep the event as received; the HTTP layer returns a retryable 5xx.
    throw error;
  }

  if (!paymentRecord ||
      paymentRecord.id !== record.gatewayPaymentId ||
      paymentRecord.order_id !== record.gatewayOrderId ||
      paymentRecord.currency !== "INR" ||
      Number(paymentRecord.amount) !== record.amountPaise) {
    await markEventStatus(eventId, "needs_review");
    return { status: 200, body: { received: true, needsReview: true, reason: "gateway_payment_mismatch" } };
  }
  if (paymentRecord.status !== "captured") {
    return { status: 503, body: { error: "Razorpay has not confirmed the captured payment yet." } };
  }

  await ensureInventory();
  await ensureVariants();
  await ensurePayments();

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();
    const [orderRows] = await connection.execute(
      "SELECT * FROM orders WHERE razorpay_order_id = ? LIMIT 2 FOR UPDATE",
      [record.gatewayOrderId]
    );

    if (!orderRows.length) {
      await markEventStatus(eventId, "needs_review", connection);
      await connection.commit();
      return { status: 200, body: { received: true, needsReview: true, reason: "sarine_order_not_found" } };
    }
    if (orderRows.length > 1) {
      await markEventStatus(eventId, "needs_review", connection);
      await connection.commit();
      return { status: 200, body: { received: true, needsReview: true, reason: "duplicate_sarine_gateway_order_reference" } };
    }

    const order = orderRows[0];
    const expectedAmountPaise = Number(
      order.razorpay_amount_paise || Math.round(Number(order.total) * 100)
    );
    if (order.payment_method !== "online" ||
        !matchesOrder(order, record.gatewayOrderId, paymentRecord.order_id) ||
        expectedAmountPaise !== Number(paymentRecord.amount)) {
      await markEventStatus(eventId, "needs_review", connection);
      await connection.commit();
      return { status: 200, body: { received: true, needsReview: true, reason: "sarine_order_mismatch" } };
    }

    const settlement = await settle(connection, {
      order,
      cleanOrderNumber: order.order_number,
      razorpay_order_id: record.gatewayOrderId,
      razorpay_payment_id: record.gatewayPaymentId,
      paymentRecord
    });
    const eventStatus = settlement.needsRefund || settlement.additionalPaymentCaptured
      ? "needs_review"
      : "processed";
    await markEventStatus(eventId, eventStatus, connection);
    await connection.commit();
    return {
      status: 200,
      body: {
        received: true,
        duplicate: !inserted,
        paymentSettlement: eventStatus,
        settlement
      }
    };
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection?.release();
  }
}
