import test from "node:test";
import assert from "node:assert/strict";
import {
  canShipOrder,
  canCancelOrder,
  shouldRestoreStockOnCancellation
} from "../orderAdminPolicy.js";

test("allows paid confirmed online orders to ship", () => {
  assert.equal(canShipOrder({
    order_status: "confirmed",
    payment_method: "online",
    payment_status: "paid"
  }), true);
});

test("allows placed COD orders to ship", () => {
  assert.equal(canShipOrder({
    order_status: "placed",
    payment_method: "cod",
    payment_status: "pending"
  }), true);
});

test("blocks orders requiring a refund from shipment", () => {
  assert.equal(canShipOrder({
    order_status: "needs_refund",
    payment_method: "online",
    payment_status: "paid",
    refund_needed: 1
  }), false);
});

test("blocks delivered, cancelled and awaiting-payment orders from shipment", () => {
  for (const order_status of ["delivered", "cancelled", "awaiting_payment"]) {
    assert.equal(canShipOrder({
      order_status,
      payment_method: "online",
      payment_status: "paid"
    }), false);
  }
});

test("restores stock for a paid order cancelled before shipment", () => {
  assert.equal(shouldRestoreStockOnCancellation({
    order_status: "confirmed",
    payment_method: "online",
    payment_status: "paid"
  }), true);
});

test("does not restore stock for needs-refund orders because stock was never deducted", () => {
  assert.equal(shouldRestoreStockOnCancellation({
    order_status: "needs_refund",
    payment_method: "online",
    payment_status: "paid",
    refund_needed: 1
  }), false);
});

test("restores stock for a placed COD order whose stock was deducted at placement", () => {
  assert.equal(shouldRestoreStockOnCancellation({
    order_status: "placed",
    payment_method: "cod",
    payment_status: "pending"
  }), true);
});

test("does not restore stock for an unpaid online order awaiting payment", () => {
  assert.equal(shouldRestoreStockOnCancellation({
    order_status: "awaiting_payment",
    payment_method: "online",
    payment_status: "pending"
  }), false);
});

test("does not restore stock for an unpaid online pending order", () => {
  assert.equal(shouldRestoreStockOnCancellation({
    order_status: "pending",
    payment_method: "online",
    payment_status: "pending"
  }), false);
});

test("allows cancellation for all pre-shipment states used by customer and admin flows", () => {
  for (const order_status of ["pending", "placed", "confirmed", "awaiting_payment", "processing"]) {
    assert.equal(canCancelOrder({ order_status }), true);
  }
});

test("blocks cancellation after shipment, delivery, or an existing cancellation", () => {
  for (const order_status of ["shipped", "delivered", "cancelled", "needs_refund", "failed"]) {
    assert.equal(canCancelOrder({ order_status }), false);
  }
});
