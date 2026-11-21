import test from "node:test";
import assert from "node:assert/strict";
import { normalizeInquiryStatus, validateContactInquiry } from "../contactInquiryPolicy.js";
test("normalizes valid enquiry fields", () => {
  assert.deepEqual(validateContactInquiry({ name: "  Asha   Verma ", email: " ASHA@example.com ", phone: "+91 98765 43210", subject: " Order question ", message: "Please help with my order." }), {
    name: "Asha Verma", email: "asha@example.com", phone: "+91 98765 43210", subject: "Order question", message: "Please help with my order."
  });
});
test("rejects missing or malformed contact details", () => {
  assert.throws(() => validateContactInquiry(null), /contact details/);
  assert.throws(() => validateContactInquiry({ name: "A", email: "bad", message: "Too short" }), /full name|valid email/);
  assert.throws(() => validateContactInquiry({ name: "Asha", email: "asha@example.com", message: "Too short" }), /at least 10/);
});
test("allows omitted optional phone and subject", () => {
  const result = validateContactInquiry({ name: "Asha", email: "asha@example.com", message: "I need help with a recent order." });
  assert.equal(result.phone, null); assert.equal(result.subject, null);
});
test("rejects invalid optional phone numbers", () => {
  assert.throws(() => validateContactInquiry({ name: "Asha", email: "asha@example.com", phone: "not a phone", message: "Please help me with this order." }), /phone number/);
});
test("rejects messages longer than the server limit", () => {
  assert.throws(() => validateContactInquiry({ name: "Asha", email: "asha@example.com", message: "x".repeat(5001) }), /too long/);
});
test("normalizes only supported statuses", () => {
  assert.equal(normalizeInquiryStatus(" REVIEWED "), "reviewed"); assert.equal(normalizeInquiryStatus("new"), "new"); assert.equal(normalizeInquiryStatus("unknown"), null);
});
