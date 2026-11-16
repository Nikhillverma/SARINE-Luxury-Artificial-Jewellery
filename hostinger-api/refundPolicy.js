const PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;
const ORDER_NUMBER = /^SAR-\d{6}$/;
const REFUND_KEY = /^[A-Za-z0-9_-]{10,64}$/;

export function buildRefundRequest(input) {
  const orderNumber = String(input?.orderNumber || "").trim();
  const paymentId = String(input?.paymentId || "").trim();
  const amountPaise = Number(input?.amountPaise);
  const reason = String(input?.reason || "").trim();
  if (!ORDER_NUMBER.test(orderNumber)) throw new Error("A valid SARINE order number is required.");
  if (!PAYMENT_ID.test(paymentId)) throw new Error("A valid Razorpay payment ID is required.");
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new Error("Refund amount must be at least ₹1.00 and use whole paise.");
  }
  if (!reason || reason.length > 500) throw new Error("A refund reason of 1–500 characters is required.");
  return { orderNumber, paymentId, amountPaise, reason };
}

export function calculateRefundableBalance(capturedPaise, refundedPaise, reservedPaise) {
  const captured = Number(capturedPaise);
  const refunded = Number(refundedPaise || 0);
  const reserved = Number(reservedPaise || 0);
  if (![captured, refunded, reserved].every(Number.isSafeInteger) || captured < 0 || refunded < 0 || reserved < 0) {
    throw new Error("Invalid gateway refund balance.");
  }
  return Math.max(0, captured - refunded - reserved);
}

export function buildRefundGatewayRequest({ amountPaise, idempotencyKey, orderNumber, reason }) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) throw new Error("Invalid refund amount.");
  if (!REFUND_KEY.test(String(idempotencyKey || ""))) throw new Error("Invalid refund idempotency key.");
  if (!ORDER_NUMBER.test(String(orderNumber || ""))) throw new Error("Invalid SARINE order number.");
  return {
    amount: amountPaise,
    receipt: `SR-${idempotencyKey}`,
    notes: { sarine_order: orderNumber, reason: String(reason || "").slice(0, 512) }
  };
}

export function normalizeGatewayRefundStatus(status) {
  if (status === "processed") return "processed";
  if (status === "failed") return "failed";
  if (status === "reversed") return "reversed";
  if (status === "pending") return "pending";
  return "unknown";
}

export function hasUnresolvedRefundRequest(statuses) {
  return Array.isArray(statuses) && statuses.some(status =>
    ["submitting", "unknown", "pending"].includes(String(status))
  );
}

export function mapRefundWebhookStatus(eventType, gatewayStatus) {
  if (eventType === "refund.failed") return "failed";
  if (eventType === "refund.reversed") return "reversed";
  if (eventType === "refund.created") return "pending";
  if (eventType === "refund.processed") return normalizeGatewayRefundStatus(gatewayStatus);
  return "unknown";
}
