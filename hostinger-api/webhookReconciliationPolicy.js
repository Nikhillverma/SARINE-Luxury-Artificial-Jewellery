export function classifyWebhookReconciliation(input) {
  const eventType = String(input?.eventType || "");
  const orderFound = Boolean(input?.orderFound);
  if (eventType === "payment.captured") {
    if (!orderFound) return "unmatched_order";
    if (!input.amountMatches) return "amount_mismatch";
    if (["cancelled", "failed", "needs_refund"].includes(input.orderStatus)) {
      return "refund_review_required";
    }
    if (input.orderPaymentStatus === "paid" && input.orderPaymentId !== input.gatewayPaymentId) {
      return "additional_capture_review";
    }
    if (input.eventStatus === "needs_review") return "manual_review";
    if (input.orderPaymentStatus !== "paid" || !input.paymentLedgerFound) {
      return "gateway_capture_not_reconciled";
    }
    return "matched";
  }
  if (eventType === "payment.failed") {
    if (!orderFound) return "unmatched_order";
    if (input.orderPaymentStatus === "paid" && input.orderPaymentId === input.gatewayPaymentId) {
      return "superseded_by_capture";
    }
    return "payment_failed_event";
  }
  if (eventType.startsWith("refund.")) {
    if (input.refundRecordStatus) return `refund_${input.refundRecordStatus}`;
    return orderFound ? "refund_event_needs_ledger_match" : "unmatched_refund";
  }
  return "event_logged";
}
