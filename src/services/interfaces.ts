/**
 * Core service interfaces defining contracts for all data access in SARINE.
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
  includeAll?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'newest' | 'price-asc' | 'price-desc';
  page?: number;
  pageSize?: number;
}
export interface IProductService {
  getProducts(filters?: ProductFilterOptions): Promise<Product[]>;
  getProductBySlug(slug: string, options?: { includeAll?: boolean }): Promise<Product | null>;
  getProductsByIds(ids: string[], options?: { includeAll?: boolean }): Promise<Product[]>;
  searchProducts(query: string, options?: { includeAll?: boolean }): Promise<Product[]>;
  getFeaturedProducts(limit?: number): Promise<Product[]>;
  getRelatedProducts(productId: string, limit?: number): Promise<Product[]>;
}
export interface ICategoryService {
  getCategories(options?: { activeOnly?: boolean }): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
}
export interface IOrderService {
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
  getOrderByNumber(orderNumber: string, publicToken?: string): Promise<Order | null>;
  verifyPayment?(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}
export interface IAdminProductService {
  getProducts(): Promise<Product[]>;
  createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<boolean>;
  archiveProduct(id: string): Promise<Product>;
}
