export interface RevenueOrderInput {
  orderStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  returnStatus?: string;
  total?: number | string;
  refundAmount?: number | string;
  [key: string]: any;
}

/**
 * Validates whether an order qualifies as realized/collected revenue.
 *
 * Rules:
 * - Excludes cancelled, returned, and failed orders.
 * - Online orders: Count ONLY when paymentStatus === 'paid'.
 * - COD orders: Count ONLY after actual delivery and payment collection
 *   (orderStatus === 'delivered' AND paymentStatus === 'paid').
 *   Confirmed and shipped COD orders are strictly excluded.
 */
export function isRealizedRevenueOrder(order: RevenueOrderInput | null | undefined): boolean {
  if (!order) return false;

  const orderStatus = (order.orderStatus || '').toLowerCase();
  const paymentStatus = (order.paymentStatus || '').toLowerCase();
  const paymentMethod = (order.paymentMethod || 'online').toLowerCase();
  const returnStatus = (order.returnStatus || '').toLowerCase();

  // Exclude cancelled, returned, or failed orders
  if (orderStatus === 'cancelled' || orderStatus === 'returned' || returnStatus === 'returned') {
    return false;
  }
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
    return false;
  }

  // COD orders count ONLY upon confirmed delivery and collected payment
  if (paymentMethod === 'cod') {
    return orderStatus === 'delivered' && paymentStatus === 'paid';
  }

  // Online orders count ONLY when payment is completed/paid
  return paymentStatus === 'paid';
}

/**
 * Calculates the realized net revenue for a single order in INR.
 *
 * Both `total` and `refundAmount` are in Indian Rupees (INR).
 * Subtracts actual refunds from the order total when refundAmount is available.
 * Returns 0 if the order is not realized or if refunds match/exceed total.
 */
export function getOrderRealizedRevenue(order: RevenueOrderInput | null | undefined): number {
  if (!order || !isRealizedRevenueOrder(order)) {
    return 0;
  }

  const rawTotal = Number(order.total);
  const total = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;

  const rawRefund = Number(order.refundAmount);
  const refundAmount = Number.isFinite(rawRefund) && rawRefund > 0 ? rawRefund : 0;

  return Math.max(0, total - refundAmount);
}

/**
 * Calculates total realized/collected revenue across an array of orders.
 */
export function calculateRealizedRevenue(orders: RevenueOrderInput[] | null | undefined): number {
  if (!orders || !Array.isArray(orders)) return 0;
  return orders.reduce((sum, o) => sum + getOrderRealizedRevenue(o), 0);
}

/**
 * Calculates Gross Merchandise Value (GMV) / pipeline value for active orders
 * (excluding cancelled, returned, or failed orders).
 * Kept separate from collected/realized revenue.
 */
export function calculateGmv(orders: RevenueOrderInput[] | null | undefined): number {
  if (!orders || !Array.isArray(orders)) return 0;

  return orders.reduce((sum, o) => {
    if (!o) return sum;
    const orderStatus = (o.orderStatus || '').toLowerCase();
    const paymentStatus = (o.paymentStatus || '').toLowerCase();
    const returnStatus = (o.returnStatus || '').toLowerCase();

    if (orderStatus === 'cancelled' || orderStatus === 'returned' || returnStatus === 'returned') {
      return sum;
    }
    if (paymentStatus === 'failed') {
      return sum;
    }

    const total = Number(o.total);
    return sum + (Number.isFinite(total) && total > 0 ? total : 0);
  }, 0);
}

/**
 * Calculates pipeline / pending revenue (GMV minus realized revenue).
 */
export function calculatePendingRevenue(orders: RevenueOrderInput[] | null | undefined): number {
  const gmv = calculateGmv(orders);
  const realized = calculateRealizedRevenue(orders);
  return Math.max(0, gmv - realized);
}
