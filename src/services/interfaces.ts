/**
 * Core service interfaces defining contracts for all data access in SARINE.
 */
import { Product, ProductVariant, JewelleryType } from '../types/product';
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
  getBestSellingProducts(limit?: number): Promise<Product[]>;
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

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  adminName: string;
  adminEmail: string;
  previousStock: number;
  quantityDelta: number;
  newStock: number;
  reason: string;
  createdAt: string;
}

export interface BulkProductUpdates { price?: number; compareAtPrice?: number | null; categoryId?: string; status?: "active" | "draft"; }

export interface BulkProductUpdateResult {
  summary: { requested: number; updated: number; skipped: number };
  results: { productId: string; productName?: string; status: "updated" | "skipped" | "not_found"; message: string }[];
}

export interface ProductVariantDraft {
  id?: string;
  option1Name: string;
  option1Value: string;
  option2Name?: string;
  option2Value?: string;
  sku: string;
  price?: number | null;
  compareAtPrice?: number | null;
  stock: number;
  status: 'active' | 'inactive';
  sortOrder?: number;
}

export interface VariantInventoryMovement {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  variantSku: string;
  variantLabel: string;
  adminName: string;
  adminEmail: string;
  previousStock: number;
  quantityDelta: number;
  newStock: number;
  reason: string;
  createdAt: string;
}

export interface IAdminProductService {
  getProducts(): Promise<Product[]>;
  createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product>;
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  saveProductVariants(productId: string, variants: ProductVariantDraft[]): Promise<{ variants: ProductVariant[]; stock: number }>;
  adjustVariantStock(variantId: string, quantityDelta: number, reason: string): Promise<{ movement: VariantInventoryMovement; productStock: number }>;
  getVariantInventoryMovements(productId: string): Promise<VariantInventoryMovement[]>;
  bulkUpdateProducts(productIds: string[], updates: BulkProductUpdates): Promise<BulkProductUpdateResult>;
  adjustStock(id: string, quantityDelta: number, reason: string): Promise<InventoryMovement>;
  getInventoryMovements(): Promise<InventoryMovement[]>;
  deleteProduct(id: string): Promise<boolean>;
  archiveProduct(id: string): Promise<Product>;
}
