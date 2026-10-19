/**
 * Category domain types for SARINE jewellery store.
 * Organizes catalogue into intuitive collections like Necklaces, Earrings, Rings, etc.
 */

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Primary category banner or cover photo URL */
  image: string;
  /** Whether the category appears in customer navigation */
  isActive: boolean;
  /** Ordering index for storefront display */
  sortOrder: number;
}
