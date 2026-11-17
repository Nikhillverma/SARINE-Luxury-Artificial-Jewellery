/**
 * Browser requests to cookie-authenticated or payment-mutating APIs must come
 * from an explicitly trusted storefront origin. Non-browser clients without
 * Origin remain supported; browsers attach Origin to cross-origin requests.
 */
export function isAllowedBrowserOrigin(origin, allowedOrigins) {
  if (origin === undefined || origin === null || origin === "") return true;
  if (typeof origin !== "string" || origin === "null") return false;
  return allowedOrigins instanceof Set && allowedOrigins.has(origin);
}
