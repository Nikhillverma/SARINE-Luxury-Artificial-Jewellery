/**
 * Shopping bag domain types for SARINE.
 * Keeps storage minimal (productId and quantity only) while hydrating display lines
 * with live product entities for accurate pricing and stock bounds.
 */

import { Product } from './product';

/**
 * Minimal persisted shape stored in localStorage.
 */
export interface CartLine {
  productId: string;
  quantity: number;
}

/**
 * Hydrated cart item containing the full live Product entity,
 * unit price, and calculated line total.
 */
export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
