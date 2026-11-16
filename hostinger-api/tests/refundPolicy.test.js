import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRefundRequest,
  calculateRefundableBalance,
  buildRefundGatewayRequest,
  normalizeGatewayRefundStatus,
  hasUnresolvedRefundRequest,
  mapRefundWebhookStatus
} from "../refundPolicy.js";

test("validates SARINE refund request and integer paise", () => {
  assert.deepEqual(buildRefundRequest({
    orderNumber: "SAR-000123", paymentId: "pay_123abc", amountPaise: 12500, reason: "Customer cancellation"
  }), { orderNumber: "SAR-000123", paymentId: "pay_123abc", amountPaise: 12500, reason: "Customer cancellation" });
  assert.throws(() => buildRefundRequest({ orderNumber: "bad", paymentId: "pay_1", amountPaise: 100, reason: "x" }));
  assert.throws(() => buildRefundRequest({ orderNumber: "SAR-000123", paymentId: "bad", amountPaise: 100, reason: "x" }));
  assert.throws(() => buildRefundRequest({ orderNumber: "SAR-000123", paymentId: "pay_1", amountPaise: 99, reason: "x" }));
  assert.throws(() => buildRefundRequest({ orderNumber: "SAR-000123", paymentId: "pay_1", amountPaise: 100.5, reason: "x" }));
});

test("calculates refundable balance after completed and reserved refunds", () => {
  assert.equal(calculateRefundableBalance(10000, 2500, 1500), 6000);
  assert.equal(calculateRefundableBalance(10000, 10000, 0), 0);
  assert.throws(() => calculateRefundableBalance(-1, 0, 0));
});

test("creates a stable idempotent gateway payload", () => {
  const payload = buildRefundGatewayRequest({
    amountPaise: 12500, idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    orderNumber: "SAR-000123", reason: "Customer request"
  });
  assert.equal(payload.amount, 12500);
  assert.equal(payload.receipt, "SR-550e8400-e29b-41d4-a716-446655440000");
  assert.equal(payload.notes.sarine_order, "SAR-000123");
  assert.throws(() => buildRefundGatewayRequest({ amountPaise: 100, idempotencyKey: "short", orderNumber: "SAR-000123" }));
});

test("normalizes only known terminal and pending gateway states", () => {
  assert.equal(normalizeGatewayRefundStatus("processed"), "processed");
  assert.equal(normalizeGatewayRefundStatus("failed"), "failed");
  assert.equal(normalizeGatewayRefundStatus("pending"), "pending");
  assert.equal(normalizeGatewayRefundStatus("reversed"), "reversed");
  assert.equal(normalizeGatewayRefundStatus("created"), "unknown");
});

test("blocks a second refund while the first request is submitting, unknown or pending", () => {
  assert.equal(hasUnresolvedRefundRequest(["processed", "pending"]), true);
  assert.equal(hasUnresolvedRefundRequest(["failed", "processed"]), false);
  assert.equal(hasUnresolvedRefundRequest([]), false);
  assert.equal(hasUnresolvedRefundRequest(null), false);
});

test("uses the actual gateway status for refund.processed webhooks", () => {
  assert.equal(mapRefundWebhookStatus("refund.processed", "processed"), "processed");
  assert.equal(mapRefundWebhookStatus("refund.processed", "failed"), "failed");
  assert.equal(mapRefundWebhookStatus("refund.processed", "reversed"), "reversed");
  assert.equal(mapRefundWebhookStatus("refund.processed", "created"), "unknown");
  assert.equal(mapRefundWebhookStatus("refund.failed", "pending"), "failed");
  assert.equal(mapRefundWebhookStatus("refund.reversed", "processed"), "reversed");
  assert.equal(mapRefundWebhookStatus("refund.created", "processed"), "pending");
});
