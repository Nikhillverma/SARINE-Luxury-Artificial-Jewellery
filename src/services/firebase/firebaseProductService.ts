/**
 * Firebase Firestore Product Service for SARINE.
 * Implements IProductService with live Firestore queries, status gating,
 * and resilient fallback to mock catalogue if Firestore permissions or connectivity fail.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit as firestoreLimit
} from 'firebase/firestore';
import { IProductService, ProductFilterOptions } from '../interfaces';
import { Product } from '../../types/product';
import { getDb, isFirebaseConfigured } from '../../lib/firebase';
import { docToProduct } from './firebaseHelpers';
import { MockProductService } from '../mock/mockProductService';

const fallbackMockService = new MockProductService();

export class FirebaseProductService implements IProductService {
  private collectionName = 'products';

  async getProducts(filters?: ProductFilterOptions): Promise<Product[]> {
    if (!isFirebaseConfigured()) {
      return fallbackMockService.getProducts(filters);
    }

    try {
      const db = getDb();
      const productsRef = collection(db, this.collectionName);

      // Build base Firestore query constraints
      const constraints: any[] = [];

      // Storefront query rule: Only return active items unless includeAll is explicitly requested
      if (!filters?.includeAll) {
        constraints.push(where('status', '==', 'active'));
      }

      if (filters?.categoryId) {
        constraints.push(where('categoryId', '==', filters.categoryId));
      }

      if (filters?.jewelleryType) {
        constraints.push(where('jewelleryType', '==', filters.jewelleryType));
      }

      const q = query(productsRef, ...constraints);
      const snapshot = await getDocs(q);

      // If Firestore is connected but collection is empty (e.g. before seeding)
      if (snapshot.empty && !filters?.categoryId && !filters?.jewelleryType) {
        console.info(
          '[FirebaseProductService] Firestore products collection is empty. Falling back to mock catalogue until seeded.'
        );
        return fallbackMockService.getProducts(filters);
      }

      let products: Product[] = [];
      snapshot.forEach((docSnap) => {
        const item = docToProduct(docSnap);
        if (item) products.push(item);
      });

      // In-memory refinements for compound filters
      products = products.filter((p) => {
        if (filters?.collectionSlug && !p.collectionSlugs.includes(filters.collectionSlug)) {
          return false;
        }

        if (filters?.inStockOnly && p.stock <= 0) {
          return false;
        }

        if (filters?.minPrice !== undefined && p.price < filters.minPrice) {
          return false;
        }

        if (filters?.maxPrice !== undefined && p.price > filters.maxPrice) {
          return false;
        }

        return true;
      });

      // Sorting
      if (filters?.sortBy) {
        if (filters.sortBy === 'newest') {
          products.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else if (filters.sortBy === 'price-asc') {
          products.sort((a, b) => a.price - b.price);
        } else if (filters.sortBy === 'price-desc') {
          products.sort((a, b) => b.price - a.price);
        }
      }

      // Pagination
      if (filters?.page && filters?.pageSize) {
        const startIndex = (filters.page - 1) * filters.pageSize;
        products = products.slice(startIndex, startIndex + filters.pageSize);
      }

      return products;
    } catch (err: any) {
      console.warn(
        '[FirebaseProductService] Error querying Firestore products (likely permission or empty rules). Falling back to mock data:',
        err?.message || err
      );
      return fallbackMockService.getProducts(filters);
    }
  }

  async getProductBySlug(
    slug: string,
    options?: { includeAll?: boolean }
  ): Promise<Product | null> {
    if (!isFirebaseConfigured()) {
      return fallbackMockService.getProductBySlug(slug, options);
    }

    try {
      const db = getDb();
      const productsRef = collection(db, this.collectionName);

      // CRITICAL: When query security rules enforce status == 'active',
      // the Firestore query MUST contain where('status', '==', 'active')
      const constraints: any[] = [where('slug', '==', slug)];
      if (!options?.includeAll) {
        constraints.push(where('status', '==', 'active'));
      }
      constraints.push(firestoreLimit(1));

      const q = query(productsRef, ...constraints);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Check if database hasn't been seeded yet; fallback to mock piece
        return fallbackMockService.getProductBySlug(slug, options);
      }

      const product = docToProduct(snapshot.docs[0]);
      if (!product) return null;

      if (!options?.includeAll && product.status !== 'active') {
        return null;
      }

      return product;
    } catch (err: any) {
      console.warn(
        `[FirebaseProductService] Firestore getProductBySlug error for "${slug}". Falling back to mock data:`,
        err?.message || err
      );
      return fallbackMockService.getProductBySlug(slug, options);
    }
  }

  async getProductsByIds(
    ids: string[],
    options?: { includeAll?: boolean }
  ): Promise<Product[]> {
    if (!ids || ids.length === 0) return [];

    if (!isFirebaseConfigured()) {
      return fallbackMockService.getProductsByIds(ids, options);
    }

    try {
      const db = getDb();

      // Safely fetch individual documents with per-document error catch
      const docPromises = ids.map(async (id) => {
        try {
          return await getDoc(doc(db, this.collectionName, id));
        } catch {
          return null;
        }
      });

      const snapshots = await Promise.all(docPromises);
      const products: Product[] = [];

      for (const snap of snapshots) {
        if (!snap || !snap.exists()) continue;
        const product = docToProduct(snap);
        if (!product) continue;
        if (!options?.includeAll && product.status !== 'active') continue;
        products.push(product);
      }

      if (products.length === 0) {
        return fallbackMockService.getProductsByIds(ids, options);
      }

      return products;
    } catch (err: any) {
      console.warn(
        '[FirebaseProductService] Error in getProductsByIds. Falling back to mock data:',
        err?.message || err
      );
      return fallbackMockService.getProductsByIds(ids, options);
    }
  }

  async searchProducts(
    queryStr: string,
    options?: { includeAll?: boolean }
  ): Promise<Product[]> {
    const cleanQuery = queryStr.trim().toLowerCase();
    if (!cleanQuery) return [];

    try {
      const allProducts = await this.getProducts({ includeAll: options?.includeAll });
      const searchTokens = cleanQuery.split(/\s+/).filter(Boolean);

      return allProducts.filter((product) => {
        const searchable = [
          product.name,
          product.description,
          product.jewelleryType,
          ...product.tags,
          product.baseMetal ?? '',
          product.stoneType ?? ''
        ]
          .join(' ')
          .toLowerCase();

        return searchTokens.every((token) => searchable.includes(token));
      });
    } catch (err) {
      return fallbackMockService.searchProducts(queryStr, options);
    }
  }

  async getFeaturedProducts(limitCount = 4): Promise<Product[]> {
    try {
      const activeProducts = await this.getProducts({ includeAll: false, inStockOnly: true });
      return activeProducts.slice(0, limitCount);
    } catch {
      return fallbackMockService.getFeaturedProducts(limitCount);
    }
  }

  async getRelatedProducts(productId: string, limitCount = 4): Promise<Product[]> {
    try {
      const db = getDb();
      let currentProduct: Product | null = null;

      try {
        const currentSnap = await getDoc(doc(db, this.collectionName, productId));
        currentProduct = docToProduct(currentSnap);
      } catch {
        // ignore and fallback below
      }

      if (!currentProduct) {
        return fallbackMockService.getRelatedProducts(productId, limitCount);
      }

      const categoryProducts = await this.getProducts({
        categoryId: currentProduct.categoryId,
        includeAll: false
      });

      const related = categoryProducts.filter((p) => p.id !== productId);
      if (related.length === 0) {
        return fallbackMockService.getRelatedProducts(productId, limitCount);
      }

      return related.slice(0, limitCount);
    } catch (err) {
      return fallbackMockService.getRelatedProducts(productId, limitCount);
    }
  }
}
