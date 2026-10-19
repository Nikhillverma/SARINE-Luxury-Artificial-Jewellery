/**
 * In-memory Mock Category Service for SARINE.
 * Implements ICategoryService with a simulated 200ms network delay.
 * Allows effortless transition to Firebase Firestore later.
 */

import { ICategoryService } from '../interfaces';
import { Category } from '../../types/category';
import { initialCategories } from './mockData';

const NETWORK_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockCategoryService implements ICategoryService {
  private categories: Category[];

  constructor(seedCategories: Category[] = initialCategories) {
    this.categories = [...seedCategories];
  }

  async getCategories(options?: { activeOnly?: boolean }): Promise<Category[]> {
    await sleep(NETWORK_DELAY_MS);

    const activeOnly = options?.activeOnly ?? true;

    return this.categories
      .filter((cat) => (activeOnly ? cat.isActive : true))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    await sleep(NETWORK_DELAY_MS);

    const category = this.categories.find((cat) => cat.slug === slug);
    return category ?? null;
  }
}
