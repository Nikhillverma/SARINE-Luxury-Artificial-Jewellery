/**
 * Central Service Switch for SARINE.
 *
 * Products and categories: Hostinger MariaDB API.
 * Orders: existing Netlify service temporarily, until Hostinger checkout is ready.
 * Admin products: existing mock service temporarily, until Hostinger admin is ready.
 */

import type {
  IProductService,
  ICategoryService,
  IAdminProductService,
  IOrderService
} from './interfaces';

import { MockProductService } from './mock/mockProductService';
import { MockCategoryService } from './mock/mockCategoryService';
import { MockAdminProductService } from './mock/mockAdminProductService';
import { NetlifyOrderService } from './netlify/netlifyOrderService';

import { HostingerProductService } from './hostinger/hostingerProductService';
import { HostingerCategoryService } from './hostinger/hostingerCategoryService';

export type DataSource = 'mock' | 'firebase' | 'hostinger';

export const DATA_SOURCE: DataSource = 'hostinger';

const mockProductService = new MockProductService();
const mockCategoryService = new MockCategoryService();
const mockAdminProductService = new MockAdminProductService(mockProductService);

const netlifyOrderService = new NetlifyOrderService();

const hostingerProductService = new HostingerProductService();
const hostingerCategoryService = new HostingerCategoryService();

export const productService: IProductService =
  DATA_SOURCE === 'hostinger'
    ? hostingerProductService
    : mockProductService;

export const categoryService: ICategoryService =
  DATA_SOURCE === 'hostinger'
    ? hostingerCategoryService
    : mockCategoryService;

export const orderService: IOrderService = netlifyOrderService;

export const adminProductService: IAdminProductService = mockAdminProductService;

export { netlifyOrderService };

export * from './interfaces';
