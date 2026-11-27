/**
 * Core service interfaces defining contracts for all data access in SARINE.
 */
import { Product, ProductVariant, JewelleryType, ProductCollection } from '../types/product';
import { Category } from '../types/category';
import { Order, CreateOrderInput, VerifyPaymentInput, VerifyPaymentResult } from '../types/order';

export interface ProductFilterOptions {
  categorySlug?: string;
  categoryId?: string;
  collectionSlug?: string;
  productCollection?: ProductCollection;
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
  getProductBySlug(slug: string, options?: { includeAll?: boolean; productCollection?: ProductCollection }): Promise<Product | null>;
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
  previousStock: number | null;
  quantityDelta: number | null;
  newStock: number;
  reason: string;
  createdAt: string;
  movementType?: 'product' | 'variant' | 'opening_balance';
  variantLabel?: string | null;
  costPriceSnapshot?: number | string | null;
  previousStockCostValue?: number | string | null;
  newStockCostValue?: number | string | null;
}

export interface InventoryMovementReportSummary { movementCount:number; stockInUnits:number; stockOutUnits:number; netChange:number; excludedOpeningSnapshots:number; }
export interface InventoryMovementReportRow { movementCount:number; stockInUnits:number; stockOutUnits:number; [key:string]:string|number|null; }
export interface InventoryMovementReport {
 summary:InventoryMovementReportSummary;
 categories:(InventoryMovementReportRow & {category:string})[];
 daily:(InventoryMovementReportRow & {movementDate:string;netChange:number})[];
 products:(InventoryMovementReportRow & {productId:string;productName:string;sku:string;movementType:string;variantLabel?:string|null;netChange:number})[];
 reasons:(InventoryMovementReportRow & {reason:string})[];
 filters:{from:string|null;to:string|null};
}
export interface InventoryMovementQuery {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
}

export interface InventoryMovementPage {
  movements: InventoryMovement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BulkProductUpdates { price?: number; compareAtPrice?: number | null; categoryId?: string; status?: "active" | "draft"; productCollection?: import("../types/product").ProductCollection; }

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
  reorderProducts(productIds: string[]): Promise<{ reordered: number }>;
  createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product>;
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  saveProductVariants(productId: string, variants: ProductVariantDraft[]): Promise<{ variants: ProductVariant[]; stock: number }>;
  adjustVariantStock(variantId: string, quantityDelta: number, reason: string): Promise<{ movement: VariantInventoryMovement; productStock: number }>;
  getVariantInventoryMovements(productId: string): Promise<VariantInventoryMovement[]>;
  bulkUpdateProducts(productIds: string[], updates: BulkProductUpdates): Promise<BulkProductUpdateResult>;
  adjustStock(id: string, quantityDelta: number, reason: string): Promise<InventoryMovement>;
  getInventoryMovements(options?: InventoryMovementQuery): Promise<InventoryMovementPage>;
  getInventoryMovementReport(options?: Pick<InventoryMovementQuery, 'from' | 'to'>): Promise<InventoryMovementReport>;
  deleteProduct(id: string): Promise<boolean>;
  archiveProduct(id: string): Promise<Product>;
}
