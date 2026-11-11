export const SHIPPING_FLAT_FEE = 99;
export const FREE_SHIPPING_THRESHOLD = 1999;
export const COD_ENABLED = true;

export function calculateShippingFee(subtotal) {
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_FLAT_FEE;
}
