import test from "node:test";
import assert from "node:assert/strict";
import { classifyWebhookReconciliation } from "../webhookReconciliationPolicy.js";

test("matches a captured payment only when the SARINE order and payment ledger agree", () => {
  assert.equal(classifyWebhookReconciliation({
    eventType: "payment.captured", orderFound: true, amountMatches: true,
    orderPaymentStatus: "paid", orderPaymentId: "pay_123", gatewayPaymentId: "pay_123",
    paymentLedgerFound: true
  }), "matched");
});

test("flags additional captured payments even when no ledger row was written", () => {
  assert.equal(classifyWebhookReconciliation({
    eventType: "payment.captured", orderFound: true, amountMatches: true,
    orderPaymentStatus: "paid", orderPaymentId: "pay_original",
    gatewayPaymentId: "pay_second", paymentLedgerFound: false
  }), "additional_capture_review");
});

test("flags amount mismatches and captures not yet reconciled", () => {
  assert.equal(classifyWebhookReconciliation({ eventType: "payment.captured", orderFound: true, amountMatches: false }), "amount_mismatch");
  assert.equal(classifyWebhookReconciliation({
    eventType: "payment.captured", orderFound: true, amountMatches: true,
    orderPaymentStatus: "awaiting_payment", paymentLedgerFound: false
  }), "gateway_capture_not_reconciled");
});

test("does not treat an old failed event as failure after the same payment is captured", () => {
  assert.equal(classifyWebhookReconciliation({
    eventType: "payment.failed", orderFound: true, orderPaymentStatus: "paid",
    orderPaymentId: "pay_123", gatewayPaymentId: "pay_123"
  }), "superseded_by_capture");
});

test("requires a refund ledger match before calling a refund event reconciled", () => {
  assert.equal(classifyWebhookReconciliation({ eventType: "refund.processed", orderFound: true }), "refund_event_needs_ledger_match");
  assert.equal(classifyWebhookReconciliation({ eventType: "refund.processed", orderFound: true, refundRecordStatus: "processed" }), "refund_processed");
});


test("routes captures on cancelled, failed, or needs-refund orders to refund review", () => {
  for (const orderStatus of ["cancelled", "failed", "needs_refund"]) {
    assert.equal(classifyWebhookReconciliation({
      eventType: "payment.captured",
      orderFound: true,
      amountMatches: true,
      orderStatus,
      orderPaymentStatus: "paid",
      orderPaymentId: "pay_123",
      gatewayPaymentId: "pay_123",
      paymentLedgerFound: true
    }), "refund_review_required");
  }
});

test("does not display a webhook marked needs_review as a successful match", () => {
  assert.equal(classifyWebhookReconciliation({
    eventType: "payment.captured",
    eventStatus: "needs_review",
    orderFound: true,
    amountMatches: true,
    orderStatus: "confirmed",
    orderPaymentStatus: "paid",
    orderPaymentId: "pay_123",
    gatewayPaymentId: "pay_123",
    paymentLedgerFound: true
  }), "manual_review");
});
