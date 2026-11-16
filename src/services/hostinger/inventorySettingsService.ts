export interface InventoryAlertSettings {
  threshold: number;
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
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Inventory alert settings could not be saved.');
  return data as T;
}

export const inventorySettingsService = {
  async get(): Promise<InventoryAlertSettings> {
    return request<InventoryAlertSettings>('/admin/inventory-settings');
  },
  async save(threshold: number): Promise<InventoryAlertSettings> {
    return request<InventoryAlertSettings>('/admin/inventory-settings', {
      method: 'PUT',
      body: JSON.stringify({ threshold })
    });
  }
};
