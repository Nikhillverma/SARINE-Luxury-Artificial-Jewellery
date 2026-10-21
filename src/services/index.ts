/**
 * Central Service Switch for SARINE.
 * Supports switching between in-memory mock services and live Firebase Firestore.
 *
 * Current Configuration:
 * - Products & Categories: Swappable via DATA_SOURCE ('mock' | 'firebase').
 * - Orders: Strictly handled via NetlifyOrderService communicating with secure server endpoints.
 */

import {
  IProductService,
  ICategoryService,
  IAdminProductService,
  IOrderService
} from './interfaces';
import { MockProductService } from './mock/mockProductService';
import { MockCategoryService } from './mock/mockCategoryService';
import { MockAdminProductService } from './mock/mockAdminProductService';
import { FirebaseProductService } from './firebase/firebaseProductService';
import { FirebaseCategoryService } from './firebase/firebaseCategoryService';
import { NetlifyOrderService } from './netlify/netlifyOrderService';

export type DataSource = 'mock' | 'firebase';

/**
 * Toggle the data source here:
 * Set to 'mock' for local in-memory catalog data.
 * Set to 'firebase' to read products and categories from Cloud Firestore.
 */
export const DATA_SOURCE: DataSource = 'firebase';

// Instantiations
const mockProductService = new MockProductService();
const mockCategoryService = new MockCategoryService();
const mockAdminProductService = new MockAdminProductService(mockProductService);
const netlifyOrderService = new NetlifyOrderService();

const firebaseProductService = new FirebaseProductService();
const firebaseCategoryService = new FirebaseCategoryService();

// Export active singletons
export const productService: IProductService =
  DATA_SOURCE === 'firebase'
    ? firebaseProductService
    : mockProductService;

export const categoryService: ICategoryService =
  DATA_SOURCE === 'firebase'
    ? firebaseCategoryService
    : mockCategoryService;

/**
 * Orders are strictly handled through Netlify server functions to guarantee
 * authoritative pricing, inventory validation, and cryptographic payment verification.
 */
export const orderService: IOrderService = netlifyOrderService;

export const adminProductService: IAdminProductService = mockAdminProductService;
export { netlifyOrderService };

export * from './interfaces';
