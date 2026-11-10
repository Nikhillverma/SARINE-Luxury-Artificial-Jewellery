import type { Category } from '../../types/category';
import type { ICategoryService } from '../interfaces';

function resolveApiBase(): string {
  const envUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HOSTINGER_API_BASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_HOSTINGER_API_BASE_URL);
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  const isDev =
    (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  if (isDev) {
    return '/api';
  }
  return 'https://greenyellow-cat-956048.hostingersite.com/api';
}

interface CategoriesResponse {
  categories: Category[];
}

interface CategoryResponse {
  category: Category;
}

async function request<T>(path: string): Promise<T> {
  const apiBase = resolveApiBase();
  const response = await fetch(`${apiBase}${path}`);

  if (!response.ok) {
    throw new Error(`Hostinger API error (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export class HostingerCategoryService implements ICategoryService {
  async getCategories(
    _options?: { activeOnly?: boolean }
  ): Promise<Category[]> {
    const result = await request<CategoriesResponse>('/categories');
    return result.categories;
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const result = await request<CategoryResponse>(
        `/categories/${encodeURIComponent(slug)}`
      );
      return result.category;
    } catch (error) {
      if (error instanceof Error && error.message.includes('(404)')) return null;
      throw error;
    }
  }
}
