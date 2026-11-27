/**
 * Central Service Switch for SARINE.
 * Storefront catalogue and administrative product writes use Hostinger MariaDB.
 */
import type { IProductService, ICategoryService, IAdminProductService, IOrderService, InventoryMovement, ProductVariantDraft, VariantInventoryMovement } from './interfaces';
import { MockProductService } from './mock/mockProductService';
import { MockCategoryService } from './mock/mockCategoryService';
import { HostingerProductService } from './hostinger/hostingerProductService';
import { HostingerCategoryService } from './hostinger/hostingerCategoryService';
import { HostingerOrderService } from './hostinger/hostingerOrderService';
import { HostingerAdminProductService } from './hostinger/hostingerAdminProductService';
import { HostingerMediaService } from './hostinger/hostingerMediaService';

export type DataSource = 'mock' | 'hostinger';
export const DATA_SOURCE: DataSource = 'hostinger';

const mockProductService = new MockProductService();
const mockCategoryService = new MockCategoryService();
const hostingerProductService = new HostingerProductService();
const hostingerCategoryService = new HostingerCategoryService();
const hostingerOrderService = new HostingerOrderService();
const hostingerAdminProductService = new HostingerAdminProductService();
const mockVariantMovements: VariantInventoryMovement[] = [];
export const hostingerMediaService = new HostingerMediaService();

export const productService: IProductService =
  DATA_SOURCE === 'hostinger' ? hostingerProductService : mockProductService;
export const categoryService: ICategoryService =
  DATA_SOURCE === 'hostinger' ? hostingerCategoryService : mockCategoryService;
export const orderService: IOrderService = hostingerOrderService;
export const adminProductService: IAdminProductService =
  DATA_SOURCE === 'hostinger' ? hostingerAdminProductService : {
    getProducts: () => mockProductService.getProducts({ includeAll: true }),
    reorderProducts: async productIds => {
      const all = mockProductService._getAllInternal();
      if (productIds.length !== all.length || new Set(productIds).size !== productIds.length) throw new Error('Refresh the catalogue before reordering.');
      const byId = new Map(all.map(item => [item.id, item]));
      const ordered = productIds.map(id => byId.get(id));
      if (ordered.some(item => !item)) throw new Error('A product is missing from the catalogue.');
      ordered.forEach((item, index) => { item!.sortOrder = index + 1; });
      all.splice(0, all.length, ...ordered as typeof all);
      return { reordered: ordered.length };
    },
    createProduct: async product => {
      const created = { ...product, id: `prod-${Date.now()}`, createdAt: new Date().toISOString() };
      mockProductService._getAllInternal().unshift(created);
      return created;
    },
    updateProduct: async (id, updates) => {
      const item = mockProductService._getAllInternal().find(p => p.id === id);
      if (!item) throw new Error('Product not found.');
      Object.assign(item, updates);
      return item;
    },
    getProductVariants: async productId => mockProductService._getAllInternal().find(item => item.id === productId)?.variants || [],
    saveProductVariants: async (productId, drafts: ProductVariantDraft[]) => {
      const item = mockProductService._getAllInternal().find(product => product.id === productId);
      if (!item) throw new Error('Product not found.');
      const variants = drafts.map((draft, index) => ({
        id: draft.id || `mock-variant-${Date.now()}-${index}`,
        productId,
        option1Name: draft.option1Name,
        option1Value: draft.option1Value,
        ...(draft.option2Name ? { option2Name: draft.option2Name } : {}),
        ...(draft.option2Value ? { option2Value: draft.option2Value } : {}),
        label: [draft.option1Value, draft.option2Value].filter(Boolean).join(' / '),
        sku: draft.sku,
        ...(draft.price == null ? {} : { price: draft.price }),
        ...(draft.compareAtPrice == null ? {} : { compareAtPrice: draft.compareAtPrice }),
        stock: draft.stock,
        status: draft.status,
        sortOrder: draft.sortOrder ?? index
      }));
      item.variants = variants;
      item.stock = variants.filter(variant => variant.status === 'active').reduce((sum, variant) => sum + variant.stock, 0);
      return { variants, stock: item.stock };
    },
    adjustVariantStock: async (variantId, quantityDelta, reason) => {
      const item = mockProductService._getAllInternal().find(product => product.variants?.some(variant => variant.id === variantId));
      const variant = item?.variants?.find(entry => entry.id === variantId);
      if (!item || !variant) throw new Error('Product variant not found.');
      const previousStock = variant.stock;
      const newStock = previousStock + quantityDelta;
      if (!Number.isInteger(quantityDelta) || quantityDelta === 0 || newStock < 0) throw new Error('Invalid variant stock adjustment.');
      variant.stock = newStock;
      item.stock = item.variants!.filter(entry => entry.status === 'active').reduce((sum, entry) => sum + entry.stock, 0);
      const movement: VariantInventoryMovement = {
        id: `mock-variant-movement-${Date.now()}`, variantId, productId: item.id,
        productName: item.name, variantSku: variant.sku, variantLabel: variant.label,
        adminName: 'Mock Admin', adminEmail: '', previousStock, quantityDelta,
        newStock, reason, createdAt: new Date().toISOString()
      };
      mockVariantMovements.unshift(movement);
      return { movement, productStock: item.stock };
    },
    getVariantInventoryMovements: async productId => mockVariantMovements.filter(movement => movement.productId === productId),
    bulkUpdateProducts: async (productIds, updates) => {
      const results = productIds.map(productId => {
        const item = mockProductService._getAllInternal().find(p => p.id === productId);
        if (!item || item.status === "archived") return { productId, productName: item?.name, status: "skipped" as const, message: "Product unavailable." };
        if (updates.price !== undefined) item.price = updates.price;
        if (updates.compareAtPrice !== undefined) item.compareAtPrice = updates.compareAtPrice ?? undefined;
        if (updates.categoryId !== undefined) item.categoryId = updates.categoryId;
        if (updates.status !== undefined) item.status = updates.status;
        return { productId, productName: item.name, status: "updated" as const, message: "Changes saved." };
      });
      const updated = results.filter(result => result.status === "updated").length;
      return { summary: { requested: productIds.length, updated, skipped: results.length - updated }, results };
    },
    adjustStock: async (id, quantityDelta, reason): Promise<InventoryMovement> => {
      const item = mockProductService._getAllInternal().find(p => p.id === id);
      if (!item) throw new Error('Product not found.');
      const previousStock = item.stock;
      const newStock = previousStock + quantityDelta;
      if (!Number.isInteger(quantityDelta) || quantityDelta === 0 || newStock < 0) throw new Error('Invalid stock adjustment.');
      item.stock = newStock;
      return {
        id: `mock-${Date.now()}`, productId: item.id, productName: item.name, sku: item.id,
        adminName: 'Mock Admin', adminEmail: '', previousStock, quantityDelta, newStock,
        reason, createdAt: new Date().toISOString()
      };
    },
    getInventoryMovements: async (options = {}) => ({ movements: [], total: 0, page: options.page ?? 1, limit: options.limit ?? 25, totalPages: 0 }),
    getInventoryMovementReport: async (options = {}) => ({ summary: { movementCount: 0, stockInUnits: 0, stockOutUnits: 0, netChange: 0, excludedOpeningSnapshots: 0 }, categories: [], daily: [], products: [], reasons: [], filters: { from: options.from || null, to: options.to || null } }),

    deleteProduct: async id => {
      const item = mockProductService._getAllInternal().find(p => p.id === id);
      if (!item) return false;
      item.status = 'archived';
      return true;
    },
    archiveProduct: async id => {
      const item = mockProductService._getAllInternal().find(p => p.id === id);
      if (!item) throw new Error('Product not found.');
      item.status = 'archived';
      return item;
    }
  };

export { hostingerOrderService };
export * from './interfaces';

export { hostingerStorefrontService } from './hostinger/hostingerStorefrontService';
