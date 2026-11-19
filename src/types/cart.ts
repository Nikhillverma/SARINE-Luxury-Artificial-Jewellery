/**
 * Shopping bag domain types for SARINE.
 * Cart identity includes a selected variant when a product has size/colour options.
 */
import { Product, ProductVariant } from './product';

export interface CartLine {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  variant?: ProductVariant;
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountedUnitPrice: number;
  discountedLineTotal: number;
  promotionLineDiscount: number;
}
