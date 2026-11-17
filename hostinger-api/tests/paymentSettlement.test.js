import test from "node:test";
import assert from "node:assert/strict";
import { settleCapturedPayment } from "../paymentSettlement.js";

function makeConnection({ productStock = 5, items = [{ product_id: "prod-1", variant_id: null, quantity: 2, product_name: "Test item" }] } = {}) {
  const calls = [];
  return {
    calls,
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("FROM order_items")) return [items];
      if (sql.includes("FROM products")) {
        return [productStock === null ? [] : [{ id: "prod-1", name: "Test item", stock: productStock }]];
      }
      return [{ affectedRows: 1 }];
    }
  };
}

function dependencies(overrides = {}) {
  return {
    sortStockItems: items => items,
    formatVariantLabel: () => "Default",
    syncProductVariantStock: async () => {},
    recordVariantInventoryMovement: async () => {},
    recordInventoryMovement: async () => {},
    confirmCouponRedemption: async () => {},
    releaseCouponRedemptionForCancelledOrder: async () => {},
    recordVerifiedPaymentEvent: async () => ({ inserted: true }),
    classifyCapturedPayment: () => "first_capture",
    ...overrides
  };
}

const context = {
  order: {
    id: "order-db-1",
    order_status: "placed",
    payment_status: "pending",
    total: "10.00",
    coupon_code: null,
    razorpay_order_id: "order_gateway1"
  },
  cleanOrderNumber: "SAR-000125",
  razorpay_order_id: "order_gateway1",
  razorpay_payment_id: "pay_gateway1",
  paymentRecord: { amount: 1000, currency: "INR" }
};

test("settles a first captured payment and records stock movement", async () => {
  const connection = makeConnection({ productStock: 5 });
  let inventoryWrites = 0;
  let paymentWrites = 0;
  const result = await settleCapturedPayment(connection, context, value => value, dependencies({
    recordInventoryMovement: async () => { inventoryWrites += 1; },
    recordVerifiedPaymentEvent: async () => { paymentWrites += 1; return { inserted: true }; }
  }));

  assert.equal(result.paymentStatus, "paid");
  assert.equal(result.orderStatus, "confirmed");
  assert.equal(inventoryWrites, 1);
  assert.equal(paymentWrites, 1);
  assert.ok(connection.calls.some(call => call.sql.includes("UPDATE products SET stock")));
  assert.ok(connection.calls.some(call => call.sql.includes("UPDATE orders") && call.sql.includes("payment_status = 'paid'")));
});

test("does not deduct stock when stock is insufficient and flags refund", async () => {
  const connection = makeConnection({ productStock: 1 });
  let couponReleased = 0;
  const order = { ...context.order, coupon_code: "TEST10" };
  const result = await settleCapturedPayment(connection, { ...context, order }, value => value, dependencies({
    releaseCouponRedemptionForCancelledOrder: async () => { couponReleased += 1; }
  }));

  assert.equal(result.orderStatus, "needs_refund");
  assert.equal(result.needsRefund, true);
  assert.equal(couponReleased, 1);
  assert.ok(!connection.calls.some(call => call.sql.includes("UPDATE products SET stock")));
  assert.ok(connection.calls.some(call => call.sql.includes("order_status = 'needs_refund'")));
});

test("same captured payment replay is idempotent", async () => {
  const connection = makeConnection();
  const order = { ...context.order, payment_status: "paid", razorpay_payment_id: context.razorpay_payment_id };
  const result = await settleCapturedPayment(connection, { ...context, order }, value => value, dependencies({
    classifyCapturedPayment: () => "same_payment_replay",
    recordVerifiedPaymentEvent: async () => ({ inserted: false })
  }));

  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.paymentStatus, "paid");
  assert.equal(connection.calls.length, 0);
});

test("additional captured payment is flagged once for manual refund review", async () => {
  const connection = makeConnection();
  const order = { ...context.order, payment_status: "paid", razorpay_payment_id: "pay_original" };
  const result = await settleCapturedPayment(connection, { ...context, order }, value => value, dependencies({
    classifyCapturedPayment: () => "additional_capture",
    recordVerifiedPaymentEvent: async () => ({ inserted: true })
  }));

  assert.equal(result.needsRefund, true);
  assert.equal(result.additionalPaymentCaptured, true);
  assert.ok(connection.calls.some(call => call.sql.includes("refund_amount = COALESCE(refund_amount, 0) + ?")));
});


test("late capture after admin cancellation is flagged for refund without restoring order or deducting stock", async () => {
  const connection = makeConnection({ productStock: 5 });
  const order = { ...context.order, order_status: "cancelled", payment_status: "pending" };
  const result = await settleCapturedPayment(connection, { ...context, order }, value => value, dependencies({
    recordVerifiedPaymentEvent: async () => ({ inserted: true })
  }));

  assert.equal(result.needsRefund, true);
  assert.equal(result.lateCaptureAfterCancellation, true);
  assert.equal(result.orderStatus, "cancelled");
  assert.ok(connection.calls.some(call =>
    call.sql.includes("refund_amount = COALESCE(refund_amount, 0) + ?")
  ));
  assert.ok(!connection.calls.some(call => call.sql.includes("FROM order_items")));
  assert.ok(!connection.calls.some(call => call.sql.includes("UPDATE products SET stock")));
});
