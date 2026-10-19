/**
 * Firebase Firestore Category Service for SARINE.
 * Implements ICategoryService using live Firestore 'categories' collection,
 * with resilient fallback to mock categories if Firestore is not yet seeded or permissions fail.
 */

import {
  collection,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { ICategoryService } from '../interfaces';
import { Category } from '../../types/category';
import { getDb, isFirebaseConfigured } from '../../lib/firebase';
import { docToCategory } from './firebaseHelpers';
import { MockCategoryService } from '../mock/mockCategoryService';

const fallbackMockCategoryService = new MockCategoryService();

export class FirebaseCategoryService implements ICategoryService {
  private collectionName = 'categories';

  async getCategories(options?: { activeOnly?: boolean }): Promise<Category[]> {
    if (!isFirebaseConfigured()) {
      return fallbackMockCategoryService.getCategories(options);
    }

    try {
      const db = getDb();
      const categoriesRef = collection(db, this.collectionName);

      const activeOnly = options?.activeOnly ?? true;

      const q = activeOnly
        ? query(categoriesRef, where('isActive', '==', true))
        : query(categoriesRef);

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return fallbackMockCategoryService.getCategories(options);
      }

      const categories: Category[] = [];
      snapshot.forEach((docSnap) => {
        const cat = docToCategory(docSnap);
        if (cat) categories.push(cat);
      });

      return categories.sort((a, b) => a.sortOrder - b.sortOrder);
    } catch (err: any) {
      console.warn(
        '[FirebaseCategoryService] Error loading Firestore categories. Falling back to mock data:',
        err?.message || err
      );
      return fallbackMockCategoryService.getCategories(options);
    }
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    if (!isFirebaseConfigured()) {
      return fallbackMockCategoryService.getCategoryBySlug(slug);
    }

    try {
      const db = getDb();
      const categoriesRef = collection(db, this.collectionName);

      const q = query(categoriesRef, where('slug', '==', slug), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return fallbackMockCategoryService.getCategoryBySlug(slug);
      }

      return docToCategory(snapshot.docs[0]);
    } catch (err: any) {
      return fallbackMockCategoryService.getCategoryBySlug(slug);
    }
  }
}
