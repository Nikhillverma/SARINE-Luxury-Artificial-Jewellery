import type { Product } from '../../types/product';
import type { IProductService, ProductFilterOptions } from '../interfaces';
import { MockProductService } from '../mock/mockProductService';

function resolveApiBase(): string {
  if (import.meta.env.VITE_HOSTINGER_API_BASE_URL) {
    return import.meta.env.VITE_HOSTINGER_API_BASE_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return 'https://greenyellow-cat-956048.hostingersite.com/api';
}

const mockFallback = new MockProductService();

interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

interface SingleProductResponse {
  product: Product;
}

async function request<T>(path: string): Promise<T> {
  const apiBase = resolveApiBase();
  const response = await fetch(`${apiBase}${path}`);

  if (!response.ok) {
    throw new Error(`Hostinger API error (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export class HostingerProductService implements IProductService {
  async getProducts(filters: ProductFilterOptions = {}): Promise<Product[]> {
    const params = new URLSearchParams();

    if (filters.categorySlug) params.set('categorySlug', filters.categorySlug);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.collectionSlug) params.set('collectionSlug', filters.collectionSlug);
    if (filters.jewelleryType) params.set('jewelleryType', filters.jewelleryType);
    if (filters.inStockOnly) params.set('inStockOnly', 'true');
    if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    if (filters.sortBy) params.set('sortBy', filters.sortBy);

    params.set('page', String(filters.page || 1));
    params.set('pageSize', String(filters.pageSize || 100));

    try {
      const result = await request<ProductResponse>(`/products?${params.toString()}`);
      return result.products;
    } catch (error) {
      console.warn('[HostingerProductService] Error loading products from API, using fallback:', error);
      return mockFallback.getProducts(filters);
    }
  }

  async getProductBySlug(
    slug: string,
    _options?: { includeAll?: boolean }
  ): Promise<Product | null> {
    try {
      const result = await request<SingleProductResponse>(
        `/products/${encodeURIComponent(slug)}`
      );
      return result.product;
    } catch (error) {
      if (error instanceof Error && error.message.includes('(404)')) return null;
      console.warn('[HostingerProductService] Error loading product from API, using fallback:', error);
      return mockFallback.getProductBySlug(slug, _options);
    }
  }

  async getProductsByIds(
    ids: string[],
    _options?: { includeAll?: boolean }
  ): Promise<Product[]> {
    if (!ids.length) return [];

    const products = await this.getProducts({ pageSize: 100 });
    const requestedIds = new Set(ids);

    return products.filter(product => requestedIds.has(product.id));
  }

  async searchProducts(
    query: string,
    _options?: { includeAll?: boolean }
  ): Promise<Product[]> {
    if (!query.trim()) return [];

    const params = new URLSearchParams({
      search: query.trim(),
      page: '1',
      pageSize: '100'
    });

    const result = await request<ProductResponse>(`/products?${params.toString()}`);
    return result.products;
  }

  async getFeaturedProducts(limit = 8): Promise<Product[]> {
    const products = await this.getProducts({
      inStockOnly: true,
      sortBy: 'newest',
      pageSize: 100
    });

    return products.slice(0, Math.max(0, limit));
  }

  async getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
    const allProducts = await this.getProducts({ pageSize: 100 });
    const current = allProducts.find(product => product.id === productId);

    if (!current) return [];

    return allProducts
      .filter(product =>
        product.id !== productId &&
        (product.categoryId === current.categoryId ||
          product.jewelleryType === current.jewelleryType)
      )
      .slice(0, Math.max(0, limit));
  }
}
