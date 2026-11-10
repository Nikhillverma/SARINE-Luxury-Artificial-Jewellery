/**
 * Server-side store configuration for SARINE.
 * Kept identical to src/config/store.ts so that prices, shipping calculation,
 * and COD rules are authoritatively calculated and enforced on the server.
 */

export const SHIPPING_FLAT_FEE = 99;
export const FREE_SHIPPING_THRESHOLD: number | null = 1999;
export const COD_ENABLED = true;
export const CURRENCY = 'INR';

export function calculateShippingFee(subtotal: number): number {
  if (FREE_SHIPPING_THRESHOLD !== null && subtotal >= FREE_SHIPPING_THRESHOLD) {
    return 0;
  }
  return SHIPPING_FLAT_FEE;
}
