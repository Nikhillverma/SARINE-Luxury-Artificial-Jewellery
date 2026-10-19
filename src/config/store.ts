/**
 * Global Store Configuration for SARINE.
 * Centralized settings for shipping, payment methods, and currency.
 * Do not hardcode these values in components or pages.
 */

/**
 * Standard flat shipping fee across India in INR.
 * Currently set to 0 (complimentary standard delivery).
 */
export const SHIPPING_FLAT_FEE = 0;

/**
 * Cart subtotal threshold in INR required for complimentary shipping.
 * Set to null when flat shipping applies uniformly regardless of subtotal.
 */
export const FREE_SHIPPING_THRESHOLD: number | null = null;

/**
 * Whether Cash on Delivery (COD) is active on checkout.
 * Default is false (online card / UPI / netbanking exclusive).
 */
export const COD_ENABLED = false;

/**
 * Store base currency ISO code.
 */
export const CURRENCY = 'INR';

/**
 * Helper to compute shipping fee based on current subtotal.
 */
export function calculateShippingFee(subtotal: number): number {
  if (FREE_SHIPPING_THRESHOLD !== null && subtotal >= FREE_SHIPPING_THRESHOLD) {
    return 0;
  }
  return SHIPPING_FLAT_FEE;
}
