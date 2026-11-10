/**
 * Global Store Configuration for SARINE.
 * Centralized settings for shipping, payment methods, and currency.
 * Do not hardcode these values in components or pages.
 */

/**
 * Standard flat shipping fee across India in INR for orders below the free-shipping threshold.
 * Kept identical to the nominal fee stated in atelier policies (₹99).
 */
export const SHIPPING_FLAT_FEE: number = 99;

/**
 * Cart subtotal threshold in INR required for complimentary shipping.
 * Orders of ₹1,999 or more qualify for free shipping.
 */
export const FREE_SHIPPING_THRESHOLD: number | null = 1999;

/**
 * Whether Cash on Delivery (COD) is active on checkout.
 * Enabled for SARINE pan-India deliveries.
 */
export const COD_ENABLED = true;

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
