import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  buildRazorpayWebhookRecord,
  verifyRazorpayWebhookSignature
} from "../razorpayWebhookPolicy.js";

test("validates Razorpay HMAC against the exact raw request bytes", () => {
  const raw = Buffer.from('{"event":"payment.captured"}');
  const secret = "test-webhook-secret";
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyRazorpayWebhookSignature(raw, signature, secret), true);
  assert.equal(verifyRazorpayWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature, secret), false);
  assert.equal(verifyRazorpayWebhookSignature(raw, signature, "wrong-secret"), false);
});

test("rejects malformed, missing and non-hex signatures", () => {
  const raw = Buffer.from("{}");
  assert.equal(verifyRazorpayWebhookSignature(raw, "", "secret"), false);
  assert.equal(verifyRazorpayWebhookSignature(raw, "not-a-signature", "secret"), false);
  assert.equal(verifyRazorpayWebhookSignature(null, "a".repeat(64), "secret"), false);
});

test("extracts only payment and refund identifiers from a verified envelope", () => {
  const record = buildRazorpayWebhookRecord("evt_123456", {
    event: "payment.captured",
    payload: { payment: { entity: {
      id: "pay_123456", order_id: "order_123456", amount: 125000,
      currency: "INR", status: "captured"
    } } }
  });
  assert.deepEqual(record, {
    eventId: "evt_123456", eventType: "payment.captured",
    gatewayOrderId: "order_123456", gatewayPaymentId: "pay_123456",
    gatewayRefundId: null, gatewayReceipt: null, amountPaise: 125000, currency: "INR",
    gatewayStatus: "captured"
  });
});

test("extracts refund references and rejects invalid event identifiers", () => {
  const record = buildRazorpayWebhookRecord("evt_refund_1", {
    event: "refund.processed",
    payload: { refund: { entity: {
      id: "rfnd_123456", payment_id: "pay_123456",
      amount: 25000, currency: "INR", status: "processed"
    } } }
  });
  assert.equal(record.gatewayRefundId, "rfnd_123456");
  assert.equal(record.gatewayPaymentId, "pay_123456");
  assert.equal(record.amountPaise, 25000);
  assert.throws(() => buildRazorpayWebhookRecord("", { event: "payment.captured" }));
  assert.throws(() => buildRazorpayWebhookRecord("evt_1", { event: "bad event" }));
});
