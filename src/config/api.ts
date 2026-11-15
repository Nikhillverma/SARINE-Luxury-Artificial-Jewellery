/**
 * SARINE Hostinger API endpoint resolver.
 * Production requests use the active Hostinger backend; local development can use a Vite /api proxy.
 */
function normalizeBaseUrl(rawUrl?: string): string {
  const configured = rawUrl?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return import.meta.env.DEV
    ? "/api"
    : "https://lavender-goldfish-844589.hostingersite.com/api";
}

export const API_BASE_URL = normalizeBaseUrl(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_HOSTINGER_API_BASE_URL : undefined
);

export function getApiEndpoint(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}
