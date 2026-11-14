/**
 * Central Service Switch for SARINE.
 * Storefront catalogue and administrative product writes use Hostinger MariaDB.
 */
import type { IProductService, ICategoryService, IAdminProductService, IOrderService, InventoryMovement } from './interfaces';
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
export const hostingerMediaService = new HostingerMediaService();

export const productService: IProductService =
  DATA_SOURCE === 'hostinger' ? hostingerProductService : mockProductService;
export const categoryService: ICategoryService =
  DATA_SOURCE === 'hostinger' ? hostingerCategoryService : mockCategoryService;
export const orderService: IOrderService = hostingerOrderService;
export const adminProductService: IAdminProductService =
  DATA_SOURCE === 'hostinger' ? hostingerAdminProductService : {
    getProducts: () => mockProductService.getProducts({ includeAll: true }),
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
    getInventoryMovements: async () => [],

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
