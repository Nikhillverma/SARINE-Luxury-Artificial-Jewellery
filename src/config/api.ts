/**
 * SARINE API Endpoint Resolver
 *
 * Dynamically resolves backend API endpoints for:
 * 1. Firebase Hosting + Netlify Functions (Hybrid / 100% Free Architecture):
 *    Set VITE_API_BASE_URL to your Netlify site URL, e.g. "https://sarine-api.netlify.app/.netlify/functions"
 * 2. Firebase Cloud Functions (Blaze Plan Architecture):
 *    Set VITE_API_BASE_URL to "/api" or Cloud Function URL (with Firebase Hosting rewrite)
 * 3. Local Development / Same-Origin Default:
 *    Defaults to "/.netlify/functions" for backward-compatibility.
 */

function normalizeBaseUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) {
    return '/.netlify/functions';
  }
  let trimmed = rawUrl.trim().replace(/\/+$/, '');
  // If user provides a Netlify domain without /.netlify/functions appended, append it
  if (trimmed.includes('.netlify.app') && !trimmed.includes('/.netlify/functions')) {
    trimmed = `${trimmed}/.netlify/functions`;
  }
  return trimmed;
}

export const API_BASE_URL = normalizeBaseUrl(
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined
);

/**
 * Returns the fully qualified or relative URL for a specific backend API endpoint.
 *
 * Examples:
 * - getApiEndpoint('create-order') -> "https://<site>.netlify.app/.netlify/functions/create-order"
 * - getApiEndpoint('admin-list-orders?limit=100') -> "https://<site>.netlify.app/.netlify/functions/admin-list-orders?limit=100"
 */
export function getApiEndpoint(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
}
