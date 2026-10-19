/**
 * In-memory Mock Admin Product Service for SARINE.
 * Provides mutation methods (create, update, delete, archive) strictly isolated
 * from customer storefront views.
 */

import { IAdminProductService } from '../interfaces';
import { Product } from '../../types/product';
import { MockProductService } from './mockProductService';

const NETWORK_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockAdminProductService implements IAdminProductService {
  private productService: MockProductService;

  constructor(productService: MockProductService) {
    this.productService = productService;
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
