const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

export interface AdminCustomer {
  email: string;
  name: string;
  phone: string;
  city: string;
  state: string;
  totalOrders: number;
  paidOrders: number;
  lifetimeSpend: number;
  averagePaidOrderValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  preferredCollection: 'artificial' | 'demi-fine' | 'unassigned' | null;
}

export interface AdminCustomerInsights {
  summary: {
    customers: number;
    payingCustomers: number;
    repeatCustomers: number;
    highValueCustomers: number;
    paidOrders: number;
    netPaidRevenue: number;
    averagePaidOrderValue: number;
  };
  collectionPreferences: Array<{
    collection: 'artificial' | 'demi-fine' | 'unassigned';
    units: number;
    itemSales: number;
    customers: number;
  }>;
}

export interface AdminCustomerOrder {
  orderNumber: string;
  createdAt: string | null;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  refundNeeded: boolean;
  refundAmount: number;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(API_BASE + '/admin/customers' + path, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Customer records could not be loaded.');
  }
  return data as T;
}

export class HostingerAdminCustomerService {
  async getInsights() {
    return request<AdminCustomerInsights>('/insights');
  }

  async getCustomers(search = '', offset = 0) {
    const params = new URLSearchParams({ limit: '50', offset: String(offset) });
    if (search.trim()) params.set('search', search.trim());
    return request<{ customers: AdminCustomer[]; total: number; limit: number; offset: number }>('?' + params.toString());
  }

  async getCustomerOrders(email: string) {
    return request<{ email: string; orders: AdminCustomerOrder[] }>('/' + encodeURIComponent(email) + '/orders');
  }
}

export const hostingerAdminCustomerService = new HostingerAdminCustomerService();
