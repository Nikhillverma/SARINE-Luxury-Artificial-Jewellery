import test from "node:test";
import assert from "node:assert/strict";
import { matchesOrderRazorpayId } from "../paymentValidation.js";

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
