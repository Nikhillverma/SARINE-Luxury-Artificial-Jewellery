/**
 * In-memory Mock Product Service for SARINE.
 * Implements IProductService with a simulated 200ms network delay.
 * Designed to be replaced with FirestoreProductService in the future without modifying UI components.
 */

import { IProductService, ProductFilterOptions } from '../interfaces';
import { Product } from '../../types/product';
import { initialProducts, initialCategories } from './mockData';

const NETWORK_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockProductService implements IProductService {
  private products: Product[];

  constructor(seedProducts: Product[] = initialProducts) {
    // Clone seed data to allow local mutations during testing
    this.products = [...seedProducts];
  }

  async getProducts(filters?: ProductFilterOptions): Promise<Product[]> {
    await sleep(NETWORK_DELAY_MS);

    let result = this.products.filter((product) => {
      // Status filter: show only 'active' items unless includeAll is explicitly true
      if (!filters?.includeAll && product.status !== 'active') {
        return false;
      }

      // Filter by categoryId
      if (filters?.categoryId && product.categoryId !== filters.categoryId) {
        return false;
      }

      // Filter by categorySlug (resolves categoryId if slug provided)
      if (filters?.categorySlug) {
        const cat = initialCategories.find((c) => c.slug === filters.categorySlug);
        if (cat && product.categoryId !== cat.id) {
          return false;
        }
      }

      // Filter by collection
      if (
        filters?.collectionSlug &&
        !product.collectionSlugs.includes(filters.collectionSlug)
      ) {
        return false;
      }

      // Filter by jewellery classification
      if (filters?.jewelleryType && product.jewelleryType !== filters.jewelleryType) {
        return false;
      }

      // Filter by stock availability
      if (filters?.inStockOnly && product.stock <= 0) {
        return false;
      }

      // Filter by price range (INR)
      if (filters?.minPrice !== undefined && product.price < filters.minPrice) {
        return false;
      }
      if (filters?.maxPrice !== undefined && product.price > filters.maxPrice) {
        return false;
      }

      return true;
    });

    // Apply sorting
    if (filters?.sortBy) {
      if (filters.sortBy === 'newest') {
        result.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else if (filters.sortBy === 'price-asc') {
        result.sort((a, b) => a.price - b.price);
      } else if (filters.sortBy === 'price-desc') {
        result.sort((a, b) => b.price - a.price);
      }
    }

    // Apply pagination if specified
    if (filters?.page && filters?.pageSize) {
      const startIndex = (filters.page - 1) * filters.pageSize;
      result = result.slice(startIndex, startIndex + filters.pageSize);
    }

    return result;
  }

  async getProductBySlug(
    slug: string,
    options?: { includeAll?: boolean }
  ): Promise<Product | null> {
    await sleep(NETWORK_DELAY_MS);

    const product = this.products.find((p) => p.slug === slug);
    if (!product) return null;

    if (!options?.includeAll && product.status !== 'active') {
      return null;
    }

    return product;
  }

  async getProductsByIds(
    ids: string[],
    options?: { includeAll?: boolean }
  ): Promise<Product[]> {
    await sleep(NETWORK_DELAY_MS);

    const idSet = new Set(ids);
    return this.products.filter((product) => {
      if (!idSet.has(product.id)) return false;
      if (!options?.includeAll && product.status !== 'active') return false;
      return true;
    });
  }

  async searchProducts(
    query: string,
    options?: { includeAll?: boolean }
  ): Promise<Product[]> {
    await sleep(NETWORK_DELAY_MS);

    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const searchTokens = cleanQuery.split(/\s+/).filter(Boolean);

    return this.products.filter((product) => {
      if (!options?.includeAll && product.status !== 'active') {
        return false;
      }

      const searchableText = [
        product.name,
        product.description,
        product.jewelleryType,
        ...product.tags,
        product.baseMetal ?? '',
        product.stoneType ?? ''
      ]
        .join(' ')
        .toLowerCase();

      return searchTokens.every((token) => searchableText.includes(token));
    });
  }

  async getFeaturedProducts(limit = 4): Promise<Product[]> {
    await sleep(NETWORK_DELAY_MS);

    return this.products
      .filter((p) => p.status === 'active' && p.stock > 0)
      .slice(0, limit);
  }

  async getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
    await sleep(NETWORK_DELAY_MS);

    const currentProduct = this.products.find((p) => p.id === productId);
    if (!currentProduct) return [];

    // Find products sharing the same category or jewellery type, excluding itself
    const related = this.products.filter((p) => {
      if (p.id === productId) return false;
      if (p.status !== 'active') return false;
      return (
        p.categoryId === currentProduct.categoryId ||
        p.jewelleryType === currentProduct.jewelleryType
      );
    });

    return related.slice(0, limit);
  }

  // Internal helper for mock updates during testing
  _getAllInternal(): Product[] {
    return this.products;
  }
}
