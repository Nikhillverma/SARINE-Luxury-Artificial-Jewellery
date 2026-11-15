/**
 * Ensure a captured Razorpay payment is being applied to the exact
 * Razorpay order persisted for the SARINE order being verified.
 */
export function matchesOrderRazorpayId(order, razorpayOrderId) {
  return (
    typeof order?.razorpay_order_id === "string" &&
    order.razorpay_order_id.length > 0 &&
    typeof razorpayOrderId === "string" &&
    razorpayOrderId.length > 0 &&
    order.razorpay_order_id === razorpayOrderId
  );
}
