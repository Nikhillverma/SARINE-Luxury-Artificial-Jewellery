/**
 * Browser requests to cookie-authenticated admin APIs must originate from an
 * explicitly trusted storefront origin. Non-browser clients without Origin
 * remain supported; browsers attach Origin to cross-origin state-changing
 * requests, including HTML form submissions.
 */
export function isAllowedAdminRequestOrigin(origin, allowedOrigins) {
  if (origin === undefined || origin === null || origin === "") return true;
  if (typeof origin !== "string" || origin === "null") return false;
  return allowedOrigins instanceof Set && allowedOrigins.has(origin);
}
