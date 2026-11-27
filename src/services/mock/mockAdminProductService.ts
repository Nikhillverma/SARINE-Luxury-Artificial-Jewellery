/**
 * In-memory Mock Admin Product Service for SARINE.
 * Provides mutation methods (create, update, delete, archive) strictly isolated
 * from customer storefront views.
 */

import { IAdminProductService, InventoryMovement, InventoryMovementQuery, InventoryMovementPage, BulkProductUpdates, BulkProductUpdateResult, ProductVariantDraft, VariantInventoryMovement } from '../interfaces';
import { Product, ProductVariant } from '../../types/product';
import { MockProductService } from './mockProductService';

const NETWORK_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockAdminProductService implements IAdminProductService {
  private productService: MockProductService;
  private movements: InventoryMovement[] = [];
  private variantMovements: VariantInventoryMovement[] = [];

  constructor(productService: MockProductService) {
    this.productService = productService;
  }

  async getProducts(): Promise<Product[]> {
    await sleep(NETWORK_DELAY_MS);
    return this.productService.getProducts({ includeAll: true });
  }

  async reorderProducts(productIds: string[]): Promise<{ reordered: number }> {
    await sleep(NETWORK_DELAY_MS);
    const all = this.productService._getAllInternal();
    if (productIds.length !== all.length || new Set(productIds).size !== productIds.length) {
      throw new Error('Refresh the catalogue before reordering.');
    }
    const byId = new Map(all.map(item => [item.id, item]));
    const ordered = productIds.map(id => byId.get(id));
    if (ordered.some(item => !item)) throw new Error('A product is missing from the catalogue.');
    ordered.forEach((item, index) => { item!.sortOrder = index + 1; });
    all.splice(0, all.length, ...ordered as Product[]);
    return { reordered: ordered.length };
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    await sleep(NETWORK_DELAY_MS);

    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    this.productService._getAllInternal().unshift(newProduct);
    return newProduct;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    await sleep(NETWORK_DELAY_MS);

    const products = this.productService._getAllInternal();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Product with ID "${id}" not found.`);
    }

    const updated = {
      ...products[index],
      ...updates
    };

    products[index] = updated;
    return updated;
  }

  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    await sleep(NETWORK_DELAY_MS);
    return [...(this.productService._getAllInternal().find(item => item.id === productId)?.variants || [])];
  }

  async saveProductVariants(productId: string, drafts: ProductVariantDraft[]): Promise<{ variants: ProductVariant[]; stock: number }> {
    await sleep(NETWORK_DELAY_MS);
    const product = this.productService._getAllInternal().find(item => item.id === productId);
    if (!product) throw new Error('Product not found.');
    const variants: ProductVariant[] = drafts.map((item, index) => ({
      id: item.id || `mock-variant-${Date.now()}-${index}`,
      productId,
      option1Name: item.option1Name,
      option1Value: item.option1Value,
      ...(item.option2Name ? { option2Name: item.option2Name } : {}),
      ...(item.option2Value ? { option2Value: item.option2Value } : {}),
      label: [item.option1Value, item.option2Value].filter(Boolean).join(' / '),
      sku: item.sku,
      ...(item.price == null ? {} : { price: item.price }),
      ...(item.compareAtPrice == null ? {} : { compareAtPrice: item.compareAtPrice }),
      stock: item.stock,
      status: item.status,
      sortOrder: item.sortOrder ?? index
    }));
    product.variants = variants;
    product.stock = variants.filter(item => item.status === 'active').reduce((sum, item) => sum + item.stock, 0);
    return { variants, stock: product.stock };
  }

  async adjustVariantStock(variantId: string, quantityDelta: number, reason: string): Promise<{ movement: VariantInventoryMovement; productStock: number }> {
    await sleep(NETWORK_DELAY_MS);
    const product = this.productService._getAllInternal().find(item => item.variants?.some(variant => variant.id === variantId));
    const variant = product?.variants?.find(item => item.id === variantId);
    if (!product || !variant) throw new Error('Product variant not found.');
    const previousStock = variant.stock;
    const newStock = previousStock + quantityDelta;
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0 || newStock < 0) throw new Error('Invalid variant stock adjustment.');
    variant.stock = newStock;
    product.stock = product.variants!.filter(item => item.status === 'active').reduce((sum, item) => sum + item.stock, 0);
    const movement: VariantInventoryMovement = {
      id: `mock-variant-movement-${Date.now()}`, variantId, productId: product.id,
      productName: product.name, variantSku: variant.sku, variantLabel: variant.label,
      adminName: 'Mock Admin', adminEmail: '', previousStock, quantityDelta,
      newStock, reason, createdAt: new Date().toISOString()
    };
    this.variantMovements.unshift(movement);
    return { movement, productStock: product.stock };
  }

  async getVariantInventoryMovements(productId: string): Promise<VariantInventoryMovement[]> {
    await sleep(NETWORK_DELAY_MS);
    return this.variantMovements.filter(item => item.productId === productId);
  }

  async bulkUpdateProducts(productIds: string[], updates: BulkProductUpdates): Promise<BulkProductUpdateResult> {
    await sleep(NETWORK_DELAY_MS);
    const products = this.productService._getAllInternal();
    const results = productIds.map(productId => {
      const product = products.find(item => item.id === productId);
      if (!product || product.status === 'archived') {
        return { productId, productName: product?.name, status: 'skipped' as const, message: 'Product unavailable.' };
      }
      const nextPrice = updates.price ?? product.price;
      const nextCompareAt = updates.compareAtPrice === undefined ? product.compareAtPrice : updates.compareAtPrice;
      if (nextCompareAt != null && nextCompareAt <= nextPrice) {
        return { productId, productName: product.name, status: 'skipped' as const, message: 'Comparison price must exceed selling price.' };
      }
      if (updates.price !== undefined) product.price = updates.price;
      if (updates.compareAtPrice !== undefined) product.compareAtPrice = updates.compareAtPrice ?? undefined;
      if (updates.categoryId !== undefined) product.categoryId = updates.categoryId;
      if (updates.status !== undefined) product.status = updates.status;
      return { productId, productName: product.name, status: 'updated' as const, message: 'Changes saved.' };
    });
    const updated = results.filter(item => item.status === 'updated').length;
    return { summary: { requested: productIds.length, updated, skipped: results.length - updated }, results };
  }

  async adjustStock(id: string, quantityDelta: number, reason: string): Promise<InventoryMovement> {
    await sleep(NETWORK_DELAY_MS);
    const product = this.productService._getAllInternal().find((item) => item.id === id);
    if (!product) throw new Error(`Product with ID "${id}" not found.`);
    const previousStock = product.stock;
    const newStock = previousStock + quantityDelta;
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0 || newStock < 0) {
      throw new Error('Invalid stock adjustment.');
    }
    product.stock = newStock;
    const movement: InventoryMovement = {
      id: `mock-${Date.now()}`, productId: product.id, productName: product.name,
      sku: product.id, adminName: 'Mock Admin', adminEmail: '',
      previousStock, quantityDelta, newStock, reason, createdAt: new Date().toISOString()
    };
    this.movements.unshift(movement);
    return movement;
  }

  async getInventoryMovementReport(options: { from?: string; to?: string } = {}): Promise<import('../interfaces').InventoryMovementReport> {
    await sleep(NETWORK_DELAY_MS);
    const all = [...this.movements, ...this.variantMovements.map(item => ({
      id:item.id, productId:item.productId, productName:item.productName, sku:item.variantSku,
      adminName:item.adminName, adminEmail:item.adminEmail, previousStock:item.previousStock,
      quantityDelta:item.quantityDelta, newStock:item.newStock, reason:item.reason,
      createdAt:item.createdAt, movementType:'variant' as const, variantLabel:item.variantLabel
    }))].filter(item => {
      const date = new Date(item.createdAt).toISOString().slice(0,10);
      return (!options.from || date >= options.from) && (!options.to || date <= options.to);
    });
    const classify=(reason:string)=>/return/i.test(reason)?'returns':/payment|checkout|order|sale/i.test(reason)?'sales':/restock|initial.*stock/i.test(reason)?'restocks':/damaged|inspection|reconciliation|adjust/i.test(reason)?'adjustments':'other';
    const sum=(items:typeof all)=>({movementCount:items.length,stockInUnits:items.reduce((n,x)=>n+Math.max(0,Number(x.quantityDelta||0)),0),stockOutUnits:items.reduce((n,x)=>n+Math.max(0,-Number(x.quantityDelta||0)),0),netChange:items.reduce((n,x)=>n+Number(x.quantityDelta||0),0)});
    const categories=[...new Set(all.map(x=>classify(x.reason)))].map(category=>({category,...sum(all.filter(x=>classify(x.reason)===category))}));
    const daily=[...new Set(all.map(x=>x.createdAt.slice(0,10)))].sort().reverse().map(movementDate=>({movementDate,...sum(all.filter(x=>x.createdAt.slice(0,10)===movementDate))}));
    const products=[...new Set(all.map(x=>[x.productId,x.sku,x.movementType||'product'].join('|')))].map(key=>{const items=all.filter(x=>[x.productId,x.sku,x.movementType||'product'].join('|')===key);const first=items[0];return {productId:first.productId,productName:first.productName,sku:first.sku,movementType:first.movementType||'product',variantLabel:first.variantLabel,...sum(items)};}).sort((a,b)=>(b.stockInUnits+b.stockOutUnits)-(a.stockInUnits+a.stockOutUnits)).slice(0,25);
    const reasons=[...new Set(all.map(x=>x.reason))].map(reason=>({reason,...sum(all.filter(x=>x.reason===reason))}));
    return {summary:{...sum(all),excludedOpeningSnapshots:0},categories,daily,products,reasons,filters:{from:options.from||null,to:options.to||null}};
  }

  async getInventoryMovements(options: InventoryMovementQuery = {}): Promise<InventoryMovementPage> {
    await sleep(NETWORK_DELAY_MS);
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 25));
    const search = options.search?.trim().toLowerCase() || '';
    const from = options.from || '';
    const to = options.to || '';
    const filtered = [...this.movements].filter(movement => {
      const text = [movement.productName, movement.sku, movement.reason, movement.adminName, movement.adminEmail]
        .some(value => String(value || '').toLowerCase().includes(search));
      const stamp = new Date(movement.createdAt);
      const date = Number.isFinite(stamp.getTime())
        ? [stamp.getFullYear(), String(stamp.getMonth() + 1).padStart(2, '0'), String(stamp.getDate()).padStart(2, '0')].join('-')
        : '';
      return (!search || text) && (!from || date >= from) && (!to || date <= to);
    });
    const total = filtered.length;
    return {
      movements: filtered.slice((page - 1) * limit, page * limit),
      total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async deleteProduct(id: string): Promise<boolean> {
    await sleep(NETWORK_DELAY_MS);

    const products = this.productService._getAllInternal();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return false;

    products.splice(index, 1);
    return true;
  }

  async archiveProduct(id: string): Promise<Product> {
    return this.updateProduct(id, { status: 'archived' });
  }
}
