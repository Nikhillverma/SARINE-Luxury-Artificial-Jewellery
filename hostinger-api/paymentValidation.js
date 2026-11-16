export function matchesOrderRazorpayId(order, submittedRazorpayOrderId, gatewayRazorpayOrderId) {
  const storedId = typeof order?.razorpay_order_id === "string" ? order.razorpay_order_id.trim() : "";
  const submittedId = typeof submittedRazorpayOrderId === "string" ? submittedRazorpayOrderId.trim() : "";
  const gatewayId = typeof gatewayRazorpayOrderId === "string" ? gatewayRazorpayOrderId.trim() : "";

  return Boolean(storedId && submittedId && gatewayId
    && storedId === submittedId
    && storedId === gatewayId);
}

export function classifyCapturedPayment(order, paymentId) {
  if (order?.payment_status !== "paid") return "first_capture";
  return order?.razorpay_payment_id === paymentId
    ? "same_payment_replay"
    : "additional_capture";
}
