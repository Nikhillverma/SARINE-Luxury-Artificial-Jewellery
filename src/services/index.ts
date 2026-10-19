/**
 * Central Service Switch for SARINE.
 * Supports switching between in-memory mock services and live Firebase Firestore.
 *
 * Current Phase Configuration:
 * - Products & Categories: Swappable via DATA_SOURCE ('mock' | 'firebase').
 * - Orders: Kept strictly on MockOrderService for now per phase requirements.
 *   (Firestore orders with authenticated write rules and Razorpay webhook validation
 *   will be introduced in the checkout integration phase).
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
import { MockOrderService } from './mock/mockOrderService';
import { FirebaseProductService } from './firebase/firebaseProductService';
import { FirebaseCategoryService } from './firebase/firebaseCategoryService';

import { NetlifyOrderService } from './netlify/netlifyOrderService';

export type DataSource = 'mock' | 'firebase';

/**
 * Toggle the data source here:
 * Set to 'mock' for local in-memory operation.
 * Set to 'firebase' to read products and categories from Cloud Firestore,
 * and route orders through secure Netlify Functions.
 */
export const DATA_SOURCE: DataSource = 'firebase';

// Instantiations
const mockProductService = new MockProductService();
const mockCategoryService = new MockCategoryService();
const mockAdminProductService = new MockAdminProductService(mockProductService);
const mockOrderService = new MockOrderService(mockProductService);

const firebaseProductService = new FirebaseProductService();
const firebaseCategoryService = new FirebaseCategoryService();
const netlifyOrderService = new NetlifyOrderService();

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
 * Order service switch:
 * - 'firebase': Routes order creation, verification, and tokenized retrieval through Netlify server functions.
 * - 'mock': Uses in-memory simulated orders in localStorage.
 */
export const orderService: IOrderService =
  DATA_SOURCE === 'firebase'
    ? netlifyOrderService
    : mockOrderService;

export const adminProductService: IAdminProductService = mockAdminProductService;
export { netlifyOrderService, mockOrderService };

export * from './interfaces';
