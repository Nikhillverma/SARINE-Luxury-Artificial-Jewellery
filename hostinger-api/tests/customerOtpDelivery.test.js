import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "sarine_auth_test";
process.env.DB_USER = "sarine_auth_test";
process.env.DB_PASSWORD = "test-only-not-a-real-password";
process.env.CUSTOMER_OTP_SECRET = "test-only-customer-otp-secret-at-least-32-characters";

const { deliverCustomerOtp } = await import("../customerOtpService.js");

test("Brevo receives a transactional SARINE email with the server-generated OTP", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) };
    return { ok: true, status: 201 };
  };
  try {
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.SARINE_EMAIL_FROM = "no-reply@example.com";
    await deliverCustomerOtp("email", "customer@example.com", "123456", "login");
    assert.equal(request.url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(request.options.headers["api-key"], "test-brevo-key");
    assert.deepEqual(request.body.to, [{ email: "customer@example.com" }]);
    assert.equal(request.body.sender.email, "no-reply@example.com");
    assert.match(request.body.htmlContent, /123456/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Fast2SMS receives the backend-generated OTP for its configured OTP template", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) };
    return { ok: true, status: 200, json: async () => ({ return: true, status_code: 200 }) };
  };
  try {
    process.env.FAST2SMS_API_KEY = "test-fast2sms-key";
    process.env.FAST2SMS_OTP_ID = "test-template-id";
    await deliverCustomerOtp("phone", "9876543210", "654321", "login");
    assert.equal(request.url, "https://www.fast2sms.com/dev/otp/send");
    assert.equal(request.options.headers.Authorization, "test-fast2sms-key");
    assert.equal(request.body.mobile, "9876543210");
    assert.equal(request.body.otp_id, "test-template-id");
    assert.equal(request.body.otp, "654321");
    assert.equal(request.body.otp_expiry, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("delivery refuses to send when provider configuration is missing", async () => {
  const originalFetch = globalThis.fetch;
  const brevoKey = process.env.BREVO_API_KEY;
  delete process.env.BREVO_API_KEY;
  globalThis.fetch = async () => { throw new Error("fetch must not be called"); };
  try {
    await assert.rejects(
      deliverCustomerOtp("email", "customer@example.com", "123456", "login"),
      /Brevo email OTP delivery is not configured/
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (brevoKey) process.env.BREVO_API_KEY = brevoKey;
  }
});
