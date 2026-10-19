/**
 * One-time Firestore Seed Utility for SARINE.
 * Uploads initialCategories and initialProducts using fixed document IDs.
 *
 * Idempotent:
 * Safe to execute multiple times because it uses setDoc with deterministic IDs
 * (e.g. 'cat-earrings', 'prod-001'), overwriting rather than duplicating records.
 *
 * Security Guard:
 * Throws an error if attempted in production.
 */

import { doc, setDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../../lib/firebase';
import { initialCategories, initialProducts } from '../mock/mockData';

export interface SeedResult {
  success: boolean;
  categoriesCount: number;
  productsCount: number;
  message: string;
}

export async function seedFirestore(): Promise<SeedResult> {
  // Prevent execution on production build
  if (import.meta.env.PROD) {
    throw new Error('Database seeding is strictly disabled in production builds.');
  }

  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase credentials not detected. Please define VITE_FIREBASE_* in your environment before seeding.'
    );
  }

  const db = getDb();

  // 1. Seed Categories with deterministic IDs
  for (const category of initialCategories) {
    const catRef = doc(db, 'categories', category.id);
    await setDoc(catRef, {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      image: category.image,
      isActive: category.isActive,
      sortOrder: category.sortOrder
    });
  }

  // 2. Seed Products with deterministic IDs
  for (const product of initialProducts) {
    const prodRef = doc(db, 'products', product.id);
    await setDoc(prodRef, {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription || null,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? null,
      images: product.images,
      categoryId: product.categoryId,
      collectionSlugs: product.collectionSlugs,
      jewelleryType: product.jewelleryType,
      stock: product.stock,
      status: product.status,
      createdAt: product.createdAt,
      tags: product.tags,
      baseMetal: product.baseMetal || null,
      platingFinish: product.platingFinish || null,
      stoneType: product.stoneType || null,
      closureType: product.closureType || null,
      careInstructions: product.careInstructions || null
    });
  }

  return {
    success: true,
    categoriesCount: initialCategories.length,
    productsCount: initialProducts.length,
    message: `Successfully seeded ${initialCategories.length} categories and ${initialProducts.length} products to Firestore.`
  };
}
