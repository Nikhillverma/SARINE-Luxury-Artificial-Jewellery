/**
 * Pure order-state safeguards shared by admin fulfilment routes and tests.
 */

export function canShipOrder(order) {
  if (!order || order.refund_needed || order.order_status === "needs_refund") {
    return false;
  }

  const statusAllowsShipment =
    (order.order_status === "placed" && order.payment_method === "cod") ||
    ["confirmed", "processing"].includes(order.order_status);

  if (!statusAllowsShipment) return false;

  return order.payment_status === "paid" || order.payment_method === "cod";
}

export function shouldRestoreStockOnCancellation(order) {
  if (!order || order.refund_needed || order.order_status === "needs_refund") {
    return false;
  }

  return order.payment_status === "paid" || order.payment_method === "cod";
}
