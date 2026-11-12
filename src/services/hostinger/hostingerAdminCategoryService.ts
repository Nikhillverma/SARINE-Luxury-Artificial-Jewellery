import type { Category } from '../../types/category';

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/admin/categories${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Category request failed (${response.status}).`);
  }
  return data as T;
}

export class HostingerAdminCategoryService {
  async getCategories(): Promise<Category[]> {
    const result = await request<{ categories: Category[] }>('');
    return result.categories;
  }

  async createCategory(input: Omit<Category, 'id'>): Promise<Category> {
    const result = await request<{ category: Category }>('', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return result.category;
  }

  async updateCategory(id: string, input: Partial<Omit<Category, 'id'>>): Promise<Category> {
    const result = await request<{ category: Category }>(`/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
    return result.category;
  }

  async deleteCategory(id: string): Promise<void> {
    await request<{ success: boolean }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

export const hostingerAdminCategoryService = new HostingerAdminCategoryService();
