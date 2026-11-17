import test from "node:test";
import assert from "node:assert/strict";
import { createOtp, hashOtp, normalizePhone, safeOtpEqual, CUSTOMER_OTP_POLICY } from "../customerOtpPolicy.js";

process.env.CUSTOMER_OTP_SECRET = "test-only-customer-otp-secret-at-least-32-characters";

test("creates six-digit OTP values", () => {
  for (let index = 0; index < 100; index += 1) assert.match(createOtp(), /^\d{6}$/);
});

test("normalizes Indian phone numbers", () => {
  assert.equal(normalizePhone("98765 43210"), "9876543210");
  assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizePhone("1234567890"), "");
  assert.equal(normalizePhone("987654321"), "");
});

test("uses a challenge-bound HMAC and constant-time comparison", () => {
  const digest = hashOtp("challenge-a", "123456");
  assert.equal(digest.length, 64);
  assert.equal(safeOtpEqual(digest, hashOtp("challenge-a", "123456")), true);
  assert.equal(safeOtpEqual(digest, hashOtp("challenge-b", "123456")), false);
  assert.equal(safeOtpEqual(digest, hashOtp("challenge-a", "654321")), false);
});

test("keeps the approved OTP policy", () => {
  assert.deepEqual(CUSTOMER_OTP_POLICY, { ttlMinutes: 5, resendCooldownSeconds: 45, maxAttempts: 5 });
});