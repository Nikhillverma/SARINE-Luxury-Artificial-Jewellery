import type { Product } from '../../types/product';
import type { IAdminProductService } from '../interfaces';

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://greenyellow-cat-956048.hostingersite.com/api')
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
    const result = await request<ProductsResponse>('/admin/products');
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
