import type { Product, ProductVariant } from '../../types/product';
import type { IAdminProductService, InventoryMovement, BulkProductUpdates, BulkProductUpdateResult, ProductVariantDraft, VariantInventoryMovement } from '../interfaces';

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
    const result = await request<ProductsResponse>('/admin/products?limit=100&page=1');
    return result.products;
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

  async getInventoryMovements(): Promise<InventoryMovement[]> {
    const result = await request<{ movements: InventoryMovement[] }>('/admin/inventory/movements');
    return result.movements;
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
