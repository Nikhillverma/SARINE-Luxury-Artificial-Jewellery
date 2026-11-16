/**
 * In-memory Mock Admin Product Service for SARINE.
 * Provides mutation methods (create, update, delete, archive) strictly isolated
 * from customer storefront views.
 */

import { IAdminProductService, InventoryMovement, BulkProductUpdates, BulkProductUpdateResult, ProductVariantDraft, VariantInventoryMovement } from '../interfaces';
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

  async getInventoryMovements(): Promise<InventoryMovement[]> {
    await sleep(NETWORK_DELAY_MS);
    return [...this.movements];
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
