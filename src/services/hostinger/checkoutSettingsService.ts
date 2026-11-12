export interface CheckoutConfig {
  shippingFlatFee: number;
  freeShippingThreshold: number;
  codEnabled: boolean;
}

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    ...options,
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Checkout settings could not be loaded.');
  return data as T;
}

export const checkoutSettingsService = {
  async getPublicConfig(): Promise<CheckoutConfig> {
    const result = await request<{ checkoutConfig: CheckoutConfig }>('/storefront/checkout-config');
    return result.checkoutConfig;
  },
  async getAdminConfig(): Promise<CheckoutConfig> {
    const result = await request<{ checkoutConfig: CheckoutConfig }>('/admin/storefront/checkout-config');
    return result.checkoutConfig;
  },
  async saveAdminConfig(config: CheckoutConfig): Promise<CheckoutConfig> {
    const result = await request<{ checkoutConfig: CheckoutConfig }>('/admin/storefront/checkout-config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    return result.checkoutConfig;
  }
};
