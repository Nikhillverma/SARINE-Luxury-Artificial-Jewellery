/**
 * Firestore conversion helpers for SARINE.
 * Normalizes document snapshots into typed Product and Category entities in one central place.
 */

import { DocumentSnapshot } from 'firebase/firestore';
import { Product } from '../../types/product';
import { Category } from '../../types/category';

/**
 * Standardizes any Firestore timestamp, JavaScript Date, or string into an ISO date string.
 */
export function formatFirestoreTimestamp(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Converts a Firestore document snapshot to a typed Product entity.
 */
export function docToProduct(snap: DocumentSnapshot): Product | null {
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data) return null;

  return {
    id: snap.id,
    slug: data.slug || snap.id,
    name: data.name || 'Untitled Piece',
    description: data.description || '',
    shortDescription: data.shortDescription,
    price: typeof data.price === 'number' ? data.price : 0,
    compareAtPrice: typeof data.compareAtPrice === 'number' ? data.compareAtPrice : undefined,
    images: Array.isArray(data.images) ? data.images : [],
    categoryId: data.categoryId || '',
    collectionSlugs: Array.isArray(data.collectionSlugs) ? data.collectionSlugs : [],
    jewelleryType: data.jewelleryType || 'necklace',
    stock: typeof data.stock === 'number' ? data.stock : 0,
    status: data.status || 'active',
    createdAt: formatFirestoreTimestamp(data.createdAt),
    tags: Array.isArray(data.tags) ? data.tags : [],
    baseMetal: data.baseMetal,
    platingFinish: data.platingFinish,
    stoneType: data.stoneType,
    closureType: data.closureType,
    careInstructions: Array.isArray(data.careInstructions) ? data.careInstructions : undefined
  };
}

/**
 * Converts a Firestore document snapshot to a typed Category entity.
 */
export function docToCategory(snap: DocumentSnapshot): Category | null {
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data) return null;

  return {
    id: snap.id,
    slug: data.slug || snap.id,
    name: data.name || '',
    description: data.description || '',
    image: data.image || '',
    isActive: Boolean(data.isActive),
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 99
  };
}
