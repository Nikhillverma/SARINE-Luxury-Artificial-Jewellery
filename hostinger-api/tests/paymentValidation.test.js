import test from "node:test";
import assert from "node:assert/strict";
import { matchesOrderRazorpayId, classifyCapturedPayment } from "../paymentValidation.js";

test("accepts a captured payment bound to the stored SARINE Razorpay order", () => {
  assert.equal(
    matchesOrderRazorpayId(
      { razorpay_order_id: "order_SARINE123" },
      "order_SARINE123",
      "order_SARINE123"
    ),
    true
  );
});

test("rejects a different submitted Razorpay order ID", () => {
  assert.equal(
    matchesOrderRazorpayId(
      { razorpay_order_id: "order_CUSTOMER_A" },
      "order_CUSTOMER_B",
      "order_CUSTOMER_B"
    ),
    false
  );
});

test("rejects a gateway payment attached to a different Razorpay order", () => {
  assert.equal(
    matchesOrderRazorpayId(
      { razorpay_order_id: "order_SARINE123" },
      "order_SARINE123",
      "order_OTHER456"
    ),
    false
  );
});

test("rejects missing stored, submitted, or gateway order IDs", () => {
  assert.equal(matchesOrderRazorpayId({}, "order_SARINE123", "order_SARINE123"), false);
  assert.equal(matchesOrderRazorpayId({ razorpay_order_id: null }, "order_SARINE123", "order_SARINE123"), false);
  assert.equal(matchesOrderRazorpayId({ razorpay_order_id: "order_SARINE123" }, "", "order_SARINE123"), false);
  assert.equal(matchesOrderRazorpayId({ razorpay_order_id: "order_SARINE123" }, "order_SARINE123", null), false);
});

test("classifies first captured payment separately from replays", () => {
  assert.equal(classifyCapturedPayment({ payment_status: "pending" }, "pay_123"), "first_capture");
});

test("treats the same captured payment ID as an idempotent replay", () => {
  assert.equal(classifyCapturedPayment({
    payment_status: "paid",
    razorpay_payment_id: "pay_123"
  }, "pay_123"), "same_payment_replay");
});

test("detects a different captured payment ID against an already-paid order", () => {
  assert.equal(classifyCapturedPayment({
    payment_status: "paid",
    razorpay_payment_id: "pay_original"
  }, "pay_additional"), "additional_capture");
});
