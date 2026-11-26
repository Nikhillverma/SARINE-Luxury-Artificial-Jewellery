import type { Product } from '../../types/product';
import type { IProductService, ProductFilterOptions } from '../interfaces';

function resolveApiBase(): string {
  if (import.meta.env.VITE_HOSTINGER_API_BASE_URL) {
    return import.meta.env.VITE_HOSTINGER_API_BASE_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return 'https://lavender-goldfish-844589.hostingersite.com/api';
}

interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

interface SingleProductResponse {
  product: Product;
}

function getSelectedProductCollection(): import('../../types/product').ProductCollection | undefined {
  const fromUrl = new URLSearchParams(window.location.search).get('range');
  if (fromUrl === 'artificial' || fromUrl === 'demi-fine') return fromUrl;
  const stored = window.sessionStorage.getItem('sarine_product_range');
  return stored === 'artificial' || stored === 'demi-fine' ? stored : undefined;
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
    const productCollection = filters.productCollection || getSelectedProductCollection();
    if (productCollection) params.set('productCollection', productCollection);
    if (filters.jewelleryType) params.set('jewelleryType', filters.jewelleryType);
    if (filters.inStockOnly) params.set('inStockOnly', 'true');
    if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    if (filters.sortBy) params.set('sortBy', filters.sortBy);

    params.set('page', String(filters.page || 1));
    params.set('pageSize', String(filters.pageSize || 100));

    const result = await request<ProductResponse>(`/products?${params.toString()}`);
    return result.products;
  }

  async getProductBySlug(
    slug: string,
    options?: { includeAll?: boolean; productCollection?: import('../../types/product').ProductCollection }
  ): Promise<Product | null> {
    try {
      const params = new URLSearchParams();
      const productCollection = options?.productCollection || getSelectedProductCollection();
      if (productCollection) params.set('productCollection', productCollection);
      const query = params.toString();
      const result = await request<SingleProductResponse>(
        `/products/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`
      );
      return result.product;
    } catch (error) {
      if (error instanceof Error && error.message.includes('(404)')) return null;
      throw error;
    }
  }

  async getProductsByIds(
    ids: string[],
    options?: { includeAll?: boolean; productCollection?: import('../../types/product').ProductCollection }
  ): Promise<Product[]> {
    if (!ids.length) return [];

    const products = await this.getProducts({ pageSize: 100, productCollection: options?.productCollection || getSelectedProductCollection() });
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
    const productCollection = getSelectedProductCollection();
    if (productCollection) params.set('productCollection', productCollection);

    const result = await request<ProductResponse>(`/products?${params.toString()}`);
    return result.products;
  }

  async getBestSellingProducts(limit = 8): Promise<Product[]> {
    const safeLimit = Math.min(24, Math.max(1, Math.floor(limit) || 8));
    const params = new URLSearchParams({ limit: String(safeLimit) });
    const productCollection = getSelectedProductCollection();
    if (productCollection) params.set('productCollection', productCollection);
    const result = await request<ProductResponse>(`/bestsellers?${params.toString()}`);
    return result.products;
  }

  async getFeaturedProducts(limit = 8): Promise<Product[]> {
    const products = await this.getProducts({
      productCollection: getSelectedProductCollection(),
      inStockOnly: true,
      sortBy: 'newest',
      pageSize: 100
    });

    return products.slice(0, Math.max(0, limit));
  }

  async getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
    const allProducts = await this.getProducts({ pageSize: 100, productCollection: getSelectedProductCollection() });
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
