import test from "node:test";
import assert from "node:assert/strict";
import { processCapturedPaymentWebhook } from "../razorpayCapturedPayment.js";
import { settleCapturedPayment } from "../paymentSettlement.js";

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


test("failed webhook transaction can be retried from received status", async () => {
  const { calls, deps } = setup();
  let attempts = 0;
  deps.settleCapturedPayment = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary database interruption");
    return { success: true, paymentStatus: "paid", orderStatus: "confirmed" };
  };

  await assert.rejects(
    processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps),
    /temporary database interruption/
  );
  const retry = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: false }, deps);

  assert.equal(retry.status, 200);
  assert.equal(retry.body.paymentSettlement, "processed");
  assert.equal(attempts, 2);
  assert.equal(calls.rolledBack, 1);
  assert.equal(calls.committed, 1);
  assert.equal(calls.marked.length, 1);
});

test("concurrent captured webhooks for one payment deduct stock only once", async () => {
  const shared = {
    order: { ...order },
    productStock: 3,
    inventoryWrites: 0,
    paymentIds: new Set(),
    eventStatuses: []
  };
  let lockTail = Promise.resolve();

  function connectionForTransaction() {
    let releaseLock = null;
    let hasLock = false;
    return {
      async beginTransaction() {},
      async execute(sql, values = []) {
        if (sql.includes("FROM orders WHERE razorpay_order_id")) {
          const previous = lockTail;
          let unlock;
          lockTail = new Promise(resolve => { unlock = resolve; });
          await previous;
          releaseLock = unlock;
          hasLock = true;
          return [[{ ...shared.order }]];
        }
        if (sql.includes("FROM order_items")) {
          return [[{ product_id: "prod-1", variant_id: null, quantity: 1, product_name: "Test item" }]];
        }
        if (sql.includes("FROM products")) {
          return [[{ id: "prod-1", name: "Test item", stock: shared.productStock }]];
        }
        if (sql.includes("UPDATE products SET stock")) {
          shared.productStock = Number(values[0]);
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("UPDATE orders") && sql.includes("payment_status = 'paid'")) {
          shared.order.payment_status = "paid";
          shared.order.order_status = "confirmed";
          shared.order.razorpay_payment_id = values[0];
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 1 }];
      },
      async commit() { if (hasLock) { hasLock = false; releaseLock(); } },
      async rollback() { if (hasLock) { hasLock = false; releaseLock(); } },
      release() {}
    };
  }

  const settleDependencies = {
    sortStockItems: items => items,
    formatVariantLabel: () => "Default",
    syncProductVariantStock: async () => {},
    recordVariantInventoryMovement: async () => {},
    recordInventoryMovement: async () => { shared.inventoryWrites += 1; },
    confirmCouponRedemption: async () => {},
    releaseCouponRedemptionForCancelledOrder: async () => {},
    recordVerifiedPaymentEvent: async (_connection, event) => {
      const inserted = !shared.paymentIds.has(event.gatewayPaymentId);
      shared.paymentIds.add(event.gatewayPaymentId);
      return { inserted };
    },
    classifyCapturedPayment: currentOrder =>
      currentOrder.payment_status === "paid" &&
      currentOrder.razorpay_payment_id === paymentRecord.id
        ? "same_payment_replay"
        : "first_capture"
  };

  const deps = {
    getEventStatus: async () => "received",
    markEventStatus: async (eventId, status) => { shared.eventStatuses.push({ eventId, status }); },
    ensureInventoryTable: async () => {},
    ensureProductVariantSchema: async () => {},
    ensurePaymentEventLogTable: async () => {},
    getConnection: async () => connectionForTransaction(),
    getRazorpay: () => ({ payments: { fetch: async () => paymentRecord } }),
    matchesOrderRazorpayId: () => true,
    settleCapturedPayment: (connection, context) =>
      settleCapturedPayment(connection, context, value => value, settleDependencies)
  };

  const firstRecord = { ...record, eventId: "evt_capture_concurrent_a" };
  const secondRecord = { ...record, eventId: "evt_capture_concurrent_b" };
  const [first, second] = await Promise.all([
    processCapturedPaymentWebhook({ record: firstRecord, eventId: firstRecord.eventId, inserted: true }, deps),
    processCapturedPaymentWebhook({ record: secondRecord, eventId: secondRecord.eventId, inserted: true }, deps)
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(shared.order.payment_status, "paid");
  assert.equal(shared.productStock, 2);
  assert.equal(shared.inventoryWrites, 1);
  assert.equal(shared.paymentIds.size, 1);
  assert.equal(shared.eventStatuses.length, 2);
  assert.ok(shared.eventStatuses.every(event => event.status === "processed"));
});


test("SARINE order amount mismatch is marked for review without settlement", async () => {
  const { calls, deps, connection } = setup();
  connection.execute = async () => [[{ ...order, total: "11.00" }]];
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps);

  assert.equal(result.body.needsReview, true);
  assert.equal(result.body.reason, "sarine_order_mismatch");
  assert.equal(calls.settled, 0);
  assert.equal(calls.marked[0].status, "needs_review");
  assert.equal(calls.marked[0].transactional, true);
  assert.equal(calls.committed, 1);
});

test("unmatched SARINE order is recorded for manual review", async () => {
  const { calls, deps, connection } = setup();
  connection.execute = async () => [[]];
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps);

  assert.equal(result.body.needsReview, true);
  assert.equal(result.body.reason, "sarine_order_not_found");
  assert.equal(calls.settled, 0);
  assert.equal(calls.marked[0].status, "needs_review");
  assert.equal(calls.committed, 1);
});

test("additional captured payment is committed to manual refund review", async () => {
  const { calls, deps } = setup({
    settleCapturedPayment: async () => ({ success: false, needsRefund: true, additionalPaymentCaptured: true })
  });
  const result = await processCapturedPaymentWebhook({ record, eventId: record.eventId, inserted: true }, deps);

  assert.equal(result.body.paymentSettlement, "needs_review");
  assert.equal(calls.marked[0].status, "needs_review");
  assert.equal(calls.committed, 1);
});
