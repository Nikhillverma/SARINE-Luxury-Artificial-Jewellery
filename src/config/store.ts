/**
 * Default checkout configuration used while the Hostinger settings endpoint loads.
 * Production values are read from MariaDB by the storefront and revalidated by the API.
 */
export interface CheckoutConfig {
  shippingFlatFee: number;
  freeShippingThreshold: number;
  codEnabled: boolean;
}

export const SHIPPING_FLAT_FEE = 99;
export const FREE_SHIPPING_THRESHOLD: number | null = 1999;
export const COD_ENABLED = true;
export const CURRENCY = 'INR';

export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = {
  shippingFlatFee: SHIPPING_FLAT_FEE,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD ?? 1999,
  codEnabled: COD_ENABLED
};

export function calculateShippingFee(
  subtotal: number,
  config: CheckoutConfig = DEFAULT_CHECKOUT_CONFIG
): number {
  if (subtotal >= config.freeShippingThreshold) return 0;
  return config.shippingFlatFee;
}
