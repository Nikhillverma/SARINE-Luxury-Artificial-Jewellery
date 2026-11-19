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

test("customer authentication schema checks are read-only", () => {
  assert.match(serviceSource, /export async function assertCustomerOtpSchema/);
  assert.doesNotMatch(serviceSource, /\b(?:ALTER\s+TABLE|CREATE\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+TABLE)\b/i);
  assert.match(serviceSource, /information_schema\.COLUMNS/);
  assert.match(serviceSource, /information_schema\.TABLES/);
});

test("OTP and identity-link routes require the explicit schema assertion", () => {
  assert.match(authSource, /await assertCustomerOtpSchema\(\)/);
  assert.match(authSource, /router\.post\("\/identity\/link\/request"/);
  assert.match(authSource, /router\.post\("\/identity\/link\/verify"/);
  assert.match(authSource, /customer_id !== current\.id/);
});
