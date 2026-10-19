/**
 * Core service interfaces defining contracts for all data access in SARINE.
 * The storefront components only talk to these interfaces, making it easy to swap
 * from mock in-memory data to Firebase Firestore later without touching UI code.
 */

import { Product, JewelleryType } from '../types/product';
import { Category } from '../types/category';
import { Order, CreateOrderInput, VerifyPaymentInput, VerifyPaymentResult } from '../types/order';

export interface ProductFilterOptions {
  categorySlug?: string;
  categoryId?: string;
  collectionSlug?: string;
  jewelleryType?: JewelleryType;
  inStockOnly?: boolean;
  /** When true, includes 'draft' and 'archived' items. Defaults to false. */
  includeAll?: boolean;

  // Extended filter options
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'newest' | 'price-asc' | 'price-desc';
  page?: number;
  pageSize?: number;
}

export interface IProductService {
  /** Retrieves products matching optional filters, sorting, and pagination */
  getProducts(filters?: ProductFilterOptions): Promise<Product[]>;

  /** Retrieves a single product by its unique URL slug */
  getProductBySlug(slug: string, options?: { includeAll?: boolean }): Promise<Product | null>;

  /** Retrieves a list of products by an array of unique product IDs */
  getProductsByIds(ids: string[], options?: { includeAll?: boolean }): Promise<Product[]>;

  /** Searches products across name, description, tags, and category */
  searchProducts(query: string, options?: { includeAll?: boolean }): Promise<Product[]>;

  /** Retrieves curated spotlight products for home/featured showcases */
  getFeaturedProducts(limit?: number): Promise<Product[]>;

  /** Retrieves related products from the same category or jewellery type */
  getRelatedProducts(productId: string, limit?: number): Promise<Product[]>;
}

export interface ICategoryService {
  /** Retrieves all categories, optionally filtering only active ones */
  getCategories(options?: { activeOnly?: boolean }): Promise<Category[]>;

  /** Retrieves a single category by its slug */
  getCategoryBySlug(slug: string): Promise<Category | null>;
}

export interface IOrderService {
  /** Creates and records a customer order after validating live prices and stock */
  createOrder(input: CreateOrderInput): Promise<Order>;

  /** Retrieves an order by its unique ID */
  getOrderById(id: string): Promise<Order | null>;

  /** Retrieves an order by its public human-readable reference number (e.g. "SAR-000101") */
  getOrderByNumber(orderNumber: string, publicToken?: string): Promise<Order | null>;

  /** Verifies server-side Razorpay signature and finalizes stock */
  verifyPayment?(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}

/**
 * Separate interface for administrative product mutations.
 * Keeping this distinct guarantees that storefront components cannot trigger write actions.
 */
export interface IAdminProductService {
  createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<boolean>;
  archiveProduct(id: string): Promise<Product>;
}
