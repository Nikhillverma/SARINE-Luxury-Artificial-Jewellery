import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "sarine_auth_schema_test";
process.env.DB_USER = "sarine_auth_schema_test";
process.env.DB_PASSWORD = "test-only-not-a-real-password";
process.env.CUSTOMER_OTP_SECRET = "test-only-customer-otp-secret-at-least-32-characters";

const serviceSource = await readFile(new URL("../customerOtpService.js", import.meta.url), "utf8");
const authSource = await readFile(new URL("../customerOtpAuth.js", import.meta.url), "utf8");

test("customer authentication schema checks are read-only and avoid system metadata schemas", () => {
  assert.ok(serviceSource.includes("export async function assertCustomerOtpSchema"));
  assert.ok(!/\\b(?:ALTER\\s+TABLE|CREATE\\s+TABLE|CREATE\\s+(?:UNIQUE\\s+)?INDEX|DROP\\s+TABLE)\\b/i.test(serviceSource));
  assert.ok(!serviceSource.includes("information_schema"));
  assert.ok(serviceSource.includes("SHOW COLUMNS FROM customers"));
  assert.ok(serviceSource.includes("SHOW TABLES LIKE"));
  assert.ok(serviceSource.includes("SHOW INDEX FROM customers"));
  assert.ok(serviceSource.includes("Number(index.Non_unique) === 0"));
});

test("OTP and identity-link routes require the explicit schema assertion", () => {
  assert.ok(authSource.includes("await assertCustomerOtpSchema()"));
  assert.ok(authSource.includes('router.post("/identity/link/request"'));
  assert.ok(authSource.includes('router.post("/identity/link/verify"'));
  assert.ok(authSource.includes("challenge.customer_id !== current.id"));
});
