import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_NAME ||= "sarine_test";
process.env.DB_USER ||= "sarine_test";
process.env.DB_PASSWORD ||= "test-only";

const { buildPaymentEventRecord, recordVerifiedPaymentEvent } = await import("../paymentEventPolicy.js");

const event = {
  orderId: "order-row-1",
  orderNumber: "SAR-000999",
  gatewayOrderId: "order_Razorpay123",
  gatewayPaymentId: "pay_Razorpay123",
  amountPaise: 189900,
  currency: "INR",
  eventType: "payment_captured",
  eventStatus: "confirmed"
};

test("normalizes and validates a captured INR payment event", () => {
  assert.deepEqual(buildPaymentEventRecord({ ...event, currency: "inr" }), {
    ...event,
    currency: "INR"
  });
});

test("rejects malformed payment IDs, amount, currency and order reference", () => {
  for (const patch of [
    { orderNumber: "SAR-999" },
    { gatewayOrderId: "wrong_order" },
    { gatewayPaymentId: "wrong_payment" },
    { amountPaise: 0 },
    { amountPaise: 1.5 },
    { currency: "USD" },
    { eventStatus: "" }
  ]) {
    assert.throws(() => buildPaymentEventRecord({ ...event, ...patch }));
  }
});

test("inserts a verified payment event once and binds it to the order", async () => {
  const calls = [];
  const connection = {
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT")) return [calls.filter(call => call.sql.startsWith("SELECT")).length === 1 ? [] : [{
        order_id: event.orderId,
        order_number: event.orderNumber,
        gateway_order_id: event.gatewayOrderId,
        gateway_payment_id: event.gatewayPaymentId,
        amount_paise: event.amountPaise,
        currency: event.currency,
        event_type: event.eventType,
        event_status: event.eventStatus
      }]];
      return [{ affectedRows: 1 }];
    }
  };

  const result = await recordVerifiedPaymentEvent(connection, event);

  assert.equal(result.inserted, true);
  assert.equal(calls.length, 3);
  assert.match(calls[1].sql, /INSERT INTO payment_event_log/);
  assert.match(calls[1].sql, /ON DUPLICATE KEY UPDATE/);
  assert.equal(calls[1].values[3], event.gatewayPaymentId);
});

test("treats a replay for the same order as idempotent", async () => {
  const connection = {
    execute: async () => [[{
      order_id: event.orderId,
      order_number: event.orderNumber,
      gateway_order_id: event.gatewayOrderId,
      gateway_payment_id: event.gatewayPaymentId,
      amount_paise: event.amountPaise,
      currency: event.currency,
      event_type: event.eventType,
      event_status: event.eventStatus
    }]]
  };

  const result = await recordVerifiedPaymentEvent(connection, event);
  assert.equal(result.inserted, false);
  assert.equal(result.event.event_status, "confirmed");
});

test("rejects reuse of a gateway payment ID for a different order", async () => {
  const connection = {
    execute: async () => [[{
      order_id: "another-order",
      order_number: "SAR-000998",
      gateway_order_id: event.gatewayOrderId,
      gateway_payment_id: event.gatewayPaymentId,
      amount_paise: event.amountPaise,
      currency: event.currency,
      event_type: event.eventType,
      event_status: event.eventStatus
    }]]
  };

  await assert.rejects(
    () => recordVerifiedPaymentEvent(connection, event),
    /different payment context/
  );
});
