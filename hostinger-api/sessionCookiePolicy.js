/**
 * Session cookies must be Secure by default, including on managed hosts that
 * do not explicitly set NODE_ENV. Plain HTTP is permitted only for local dev.
 */
export function shouldUseSecureSessionCookie(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv !== "development";
}
