import test from "node:test";
import assert from "node:assert/strict";
import { processCapturedPaymentWebhook } from "../razorpayCapturedPayment.js";

const record = {
  eventId: "evt_capture_1",
  eventType: "payment.captured",
  gatewayOrderId: "order_gateway1",
  gatewayPaymentId: "pay_gateway1",
  amountPaise: 1000,
  currency: "INR",
  gatewayStatus: "captured"
};
const paymentRecord = {
  id: "pay_gateway1",
  order_id: "order_gateway1",
  amount: 1000,
  currency: "INR",
  status: "captured"
};
const order = {
  id: "order-db-1",
  order_number: "SAR-000125",
  payment_method: "online",
  payment_status: "pending",
  order_status: "placed",
  total: "10.00",
  razorpay_amount_paise: 1000
};

function setup(overrides = {}) {
  const calls = { marked: [], committed: 0, rolledBack: 0, released: 0, fetched: 0, settled: 0 };
  const connection = {
    async beginTransaction() {},
    async execute() { return [[order]]; },
    async commit() { calls.committed += 1; },
    async rollback() { calls.rolledBack += 1; },
    release() { calls.released += 1; }
  };
  const deps = {
    getEventStatus: async () => "received",
    markEventStatus: async (eventId, status, conn) => { calls.marked.push({ eventId, status, transactional: Boolean(conn) }); },
    ensureInventoryTable: async () => {},
    ensureProductVariantSchema: async () => {},
    ensurePaymentEventLogTable: async () => {},
    getConnection: async () => connection,
    getRazorpay: () => ({ payments: { fetch: async () => { calls.fetched += 1; return paymentRecord; } } }),
    matchesOrderRazorpayId: () => true,
    settleCapturedPayment: async () => { calls.settled += 1; return { success: true, paymentStatus: "paid", orderStatus: "confirmed" }; },
    ...overrides
  };
  return { calls, connection, deps };
}

test("captured webhook verifies gateway payment and settles the matching SARINE order", async () => {
  const { calls, deps } = setup();
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps);

  assert.equal(result.status, 200);
  assert.equal(result.body.paymentSettlement, "processed");
  assert.equal(calls.fetched, 1);
  assert.equal(calls.settled, 1);
  assert.deepEqual(calls.marked, [{ eventId: record.eventId, status: "processed", transactional: true }]);
  assert.equal(calls.committed, 1);
  assert.equal(calls.rolledBack, 0);
  assert.equal(calls.released, 1);
});

test("already processed duplicate webhook is acknowledged without settling again", async () => {
  const { calls, deps } = setup({ getEventStatus: async () => "processed" });
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: false }, deps);

  assert.equal(result.status, 200);
  assert.equal(result.body.paymentSettlement, "processed");
  assert.equal(calls.fetched, 0);
  assert.equal(calls.settled, 0);
});

test("gateway amount mismatch is routed to review without changing the order", async () => {
  const { calls, deps } = setup({
    getRazorpay: () => ({ payments: { fetch: async () => ({ ...paymentRecord, amount: 999 }) } })
  });
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps);

  assert.equal(result.body.needsReview, true);
  assert.equal(result.body.reason, "gateway_payment_mismatch");
  assert.equal(calls.settled, 0);
  assert.deepEqual(calls.marked[0], { eventId: record.eventId, status: "needs_review", transactional: false });
});

test("webhook remains retryable while gateway has not confirmed capture", async () => {
  const { calls, deps } = setup({
    getRazorpay: () => ({ payments: { fetch: async () => ({ ...paymentRecord, status: "authorized" }) } })
  });
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps);

  assert.equal(result.status, 503);
  assert.equal(calls.marked.length, 0);
  assert.equal(calls.settled, 0);
});

test("stock-conflict settlement is committed but webhook is marked for review", async () => {
  const { calls, deps } = setup({
    settleCapturedPayment: async () => ({ success: false, needsRefund: true, orderStatus: "needs_refund" })
  });
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps);

  assert.equal(result.body.paymentSettlement, "needs_review");
  assert.equal(calls.marked[0].status, "needs_review");
  assert.equal(calls.committed, 1);
});

test("settlement failure rolls back so the received webhook can be retried", async () => {
  const { calls, deps } = setup({
    settleCapturedPayment: async () => { throw new Error("simulated database failure"); }
  });

  await assert.rejects(
    processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps),
    /simulated database failure/
  );
  assert.equal(calls.committed, 0);
  assert.equal(calls.rolledBack, 1);
  assert.equal(calls.released, 1);
  assert.equal(calls.marked.length, 0);
});
