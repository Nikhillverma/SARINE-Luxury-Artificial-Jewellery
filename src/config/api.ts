/**
 * SARINE API endpoint resolver.
 * Production storefront requests go directly to the Hostinger Express API.
 */
const DEFAULT_API_BASE_URL = 'https://lavender-goldfish-844589.hostingersite.com/api';

function normalizeBaseUrl(rawUrl?: string): string {
  const value = rawUrl?.trim();
  if (!value) return DEFAULT_API_BASE_URL;
  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = normalizeBaseUrl(
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_HOSTINGER_API_BASE_URL : undefined
);

export function getApiEndpoint(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}
