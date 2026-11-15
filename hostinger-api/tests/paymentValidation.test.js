import test from "node:test";
import assert from "node:assert/strict";
import { matchesOrderRazorpayId } from "../paymentValidation.js";

test("accepts only the Razorpay order ID stored for the SARINE order", () => {
  assert.equal(
    matchesOrderRazorpayId({ razorpay_order_id: "order_SARINE123" }, "order_SARINE123"),
    true
  );
});

test("rejects a different Razorpay order ID even when it is otherwise valid", () => {
  assert.equal(
    matchesOrderRazorpayId({ razorpay_order_id: "order_CUSTOMER_A" }, "order_CUSTOMER_B"),
    false
  );
});

test("rejects missing or malformed stored and submitted order IDs", () => {
  assert.equal(matchesOrderRazorpayId({}, "order_SARINE123"), false);
  assert.equal(matchesOrderRazorpayId({ razorpay_order_id: null }, "order_SARINE123"), false);
  assert.equal(matchesOrderRazorpayId({ razorpay_order_id: "order_SARINE123" }, ""), false);
  assert.equal(matchesOrderRazorpayId({ razorpay_order_id: "order_SARINE123" }, null), false);
});
