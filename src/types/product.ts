/**
 * Product domain types for SARINE jewellery store.
 * Represents physical and display attributes of each handcrafted-style piece.
 */

export type JewelleryType =
  | 'earrings'
  | 'necklace'
  | 'bracelet'
  | 'ring'
  | 'anklet'
  | 'set';

export type ProductStatus = 'active' | 'draft' | 'archived';
export type ProductCollection = 'artificial' | 'demi-fine';

export const JEWELLERY_TYPE_LABELS: Record<JewelleryType, string> = {
  earrings: 'Earrings',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  ring: 'Ring',
  anklet: 'Anklet',
  set: 'Jewellery Set'
} as const;

export interface ProductVariant {
  id: string;
  productId: string;
  option1Name: string;
  option1Value: string;
  option2Name?: string;
  option2Value?: string;
  label: string;
  sku: string;
  /** Optional variant override; omitted values inherit the parent product. */
  price?: number;
  compareAtPrice?: number;
  stock: number;
  status: 'active' | 'inactive';
  sortOrder: number;
}

export interface Product {
  id: string;
  /** Catalogue audience keeps men's and women's products independently managed. */
  gender?: "men" | "women";
  slug: string;
  name: string;
  /** SARINE's top-level product range; separate from merchandising collectionSlugs. */
  productCollection?: ProductCollection;
  description: string;
  /** Price in INR as an integer, e.g. 1499 */
  price: number;
  /** Optional comparison MRP/original price for discount display */
  compareAtPrice?: number | null;
  /** Optional manufacturing / procurement cost price in INR */
  costPrice?: number;
  /** Array of product photo URLs */
  images: string[];
  /** Foreign key pointing to Category.id */
  categoryId: string;
  /** Curated collections this piece belongs to (e.g. ['festive', 'everyday', 'heritage']) */
  collectionSlugs: string[];
  /** Categorical jewellery classification */
  jewelleryType: JewelleryType;
  /** Available physical stock count */
  stock: number;
  /** Publishing lifecycle state */
  status: ProductStatus;
  /** Creation timestamp in ISO string format */
  createdAt: string;
  /** Search and filtering tags */
  tags: string[];

  // Optional styling & design metadata for rich detail display
  shortDescription?: string;
  baseMetal?: string;
  platingFinish?: string;
  stoneType?: string;
  closureType?: string;
  careInstructions?: string[];
  /** Optional HTTPS MP4/WebM product demonstration video. */
  productVideoUrl?: string;
  /** Active purchasable size/colour combinations, if this design uses variants. */
  variants?: ProductVariant[];
}

/* ==========================================================================
   Domain Helpers
   ========================================================================== */

/**
 * Checks whether physical stock exists on hand.
 */
export function isInStock(product: Pick<Product, 'stock'>): boolean {
  return product.stock > 0;
}

/**
 * Checks whether an item is eligible for customer purchase (active status & in stock).
 */
export function isPurchasable(
  product: Pick<Product, 'status' | 'stock'>
): boolean {
  return product.status === 'active' && product.stock > 0;
}

/**
 * Computes floored discount percentage when compareAtPrice > price.
 * Returns null if no valid discount exists.
 */
export function getDiscountPercent(
  product: Pick<Product, 'price' | 'compareAtPrice'>
): number | null {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) {
    return null;
  }
  const discount = Math.floor(
    ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100
  );
  return discount > 0 ? discount : null;
}
