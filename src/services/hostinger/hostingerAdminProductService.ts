import type { Product, ProductVariant } from '../../types/product';
import type { IAdminProductService, InventoryMovement, InventoryMovementQuery, InventoryMovementPage, BulkProductUpdates, BulkProductUpdateResult, ProductVariantDraft, VariantInventoryMovement } from '../interfaces';

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

interface ProductsResponse { products: Product[]; total: number; }
interface ProductResponse { product: Product; }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Admin product request failed (${response.status}).`);
  }
  return data as T;
}

export class HostingerAdminProductService implements IAdminProductService {
  async getProducts(): Promise<Product[]> {
    const pageSize = 100;
    const first = await request<ProductsResponse>(`/admin/products?limit=${pageSize}&page=1`);
    const products = [...first.products];
    const pageCount = Math.ceil(first.total / pageSize);

    // The admin screens use client-side filtering and pagination, so load every
    // server page rather than silently omitting products after the first 100.
    for (let startPage = 2; startPage <= pageCount; startPage += 5) {
      const endPage = Math.min(pageCount, startPage + 4);
      const pages = await Promise.all(
        Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index)
          .map(page => request<ProductsResponse>(`/admin/products?limit=${pageSize}&page=${page}`))
      );
      for (const page of pages) products.push(...page.products);
    }

    return products;
  }

  async createProduct(product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    const result = await request<ProductResponse>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });
    return result.product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const result = await request<ProductResponse>(`/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return result.product;
  }


  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    const result = await request<{ variants: ProductVariant[] }>(`/admin/products/${encodeURIComponent(productId)}/variants`);
    return result.variants;
  }

  async saveProductVariants(productId: string, variants: ProductVariantDraft[]): Promise<{ variants: ProductVariant[]; stock: number }> {
    return request<{ variants: ProductVariant[]; stock: number }>(`/admin/products/${encodeURIComponent(productId)}/variants`, {
      method: 'PUT',
      body: JSON.stringify({ variants })
    });
  }

  async adjustVariantStock(variantId: string, quantityDelta: number, reason: string): Promise<{ movement: VariantInventoryMovement; productStock: number }> {
    return request<{ movement: VariantInventoryMovement; productStock: number }>('/admin/inventory/variants/adjustments', {
      method: 'POST',
      body: JSON.stringify({ variantId, quantityDelta, reason })
    });
  }

  async getVariantInventoryMovements(productId: string): Promise<VariantInventoryMovement[]> {
    const result = await request<{ movements: VariantInventoryMovement[] }>(`/admin/inventory/variants/movements?productId=${encodeURIComponent(productId)}`);
    return result.movements;
  }

  async bulkUpdateProducts(productIds: string[], updates: BulkProductUpdates): Promise<BulkProductUpdateResult> {
    return request<BulkProductUpdateResult>("/admin/products/bulk", {
      method: "POST", body: JSON.stringify({ productIds, updates })
    });
  }

  async adjustStock(id: string, quantityDelta: number, reason: string): Promise<InventoryMovement> {
    const result = await request<{ movement: InventoryMovement }>('/admin/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify({ productId: id, quantityDelta, reason })
    });
    return result.movement;
  }

  async getInventoryMovements(options: InventoryMovementQuery = {}): Promise<InventoryMovementPage> {
    const params = new URLSearchParams();
    if (options.page !== undefined) params.set('page', String(options.page));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.search?.trim()) params.set('search', options.search.trim());
    if (options.from) params.set('from', options.from);
    if (options.to) params.set('to', options.to);
    const query = params.toString();
    return request<InventoryMovementPage>(`/admin/inventory/movements${query ? `?${query}` : ''}`);
  }

  async deleteProduct(id: string): Promise<boolean> {
    await this.archiveProduct(id);
    return true;
  }

  async archiveProduct(id: string): Promise<Product> {
    const result = await request<ProductResponse>(`/admin/products/${encodeURIComponent(id)}/archive`, {
      method: 'PATCH'
    });
    return result.product;
  }
}

export async function fetchAdminProductPreview(productId: string): Promise<Product> {
  const result = await request<{ product: Product; previewOnly: true; purchaseEnabled: false }>(
    `/admin/products/${encodeURIComponent(productId)}/preview`
  );
  if (result.previewOnly !== true || result.purchaseEnabled !== false) {
    throw new Error('The product preview response was not marked as read-only.');
  }
  return result.product;
}
