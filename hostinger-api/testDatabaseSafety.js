const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * Guard destructive MariaDB integration tests from ever targeting a live database.
 * Requires explicit opt-in, a loopback DB host, and a test-suffixed database name.
 */
export function assertSafeTestDatabase(env = process.env) {
  const host = String(env.DB_HOST || "").trim().toLowerCase();
  const database = String(env.DB_NAME || "").trim();
  const optedIn = env.SARINE_ALLOW_DESTRUCTIVE_TEST_DB === "true";

  if (!optedIn) {
    throw new Error("Refusing destructive integration test: set SARINE_ALLOW_DESTRUCTIVE_TEST_DB=true only for an isolated test database.");
  }
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error("Refusing destructive integration test: DB_HOST must be localhost, 127.0.0.1, or ::1.");
  }
  if (!/(?:^|[_-])test$/i.test(database)) {
    throw new Error("Refusing destructive integration test: DB_NAME must end in _test or -test.");
  }
  return true;
}
