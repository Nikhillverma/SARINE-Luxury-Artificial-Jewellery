import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "sarine_auth_test";
process.env.DB_USER = "sarine_auth_test";
process.env.DB_PASSWORD = "test-only-not-a-real-password";
process.env.CUSTOMER_OTP_SECRET = "test-only-customer-otp-secret-at-least-32-characters";
process.env.MSG91_EMAIL_ENABLED = "false";

const { deliverCustomerOtp, getCustomerOtpProvider } = await import("../customerOtpService.js");

test("MSG91 email delivery is disabled by default and never calls the provider", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fetch must not be called while disabled"); };
  try {
    assert.equal(getCustomerOtpProvider("email"), "MSG91");
    await assert.rejects(
      deliverCustomerOtp("email", "customer@example.com", "123456", "login"),
      /disabled until the SARINE sending domain is verified/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MSG91 receives the server-generated OTP through the approved global_otp template", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: "success", hasError: false, data: { unique_id: "test-message-id" } })
    };
  };
  try {
    process.env.MSG91_EMAIL_ENABLED = "true";
    process.env.MSG91_EMAIL_AUTH_KEY = "test-msg91-auth-key";
    process.env.MSG91_EMAIL_DOMAIN = "mail.sarine.example";
    process.env.MSG91_EMAIL_FROM = "no-reply@mail.sarine.example";
    process.env.MSG91_EMAIL_FROM_NAME = "SARINE";
    process.env.MSG91_EMAIL_TEMPLATE_ID = "global_otp";

    await deliverCustomerOtp("email", "customer@example.com", "123456", "login");

    assert.equal(request.url, "https://control.msg91.com/api/v5/email/send");
    assert.equal(request.options.headers.authkey, "test-msg91-auth-key");
    assert.equal(request.body.template_id, "global_otp");
    assert.equal(request.body.domain, "mail.sarine.example");
    assert.deepEqual(request.body.from, { name: "SARINE", email: "no-reply@mail.sarine.example" });
    assert.deepEqual(request.body.recipients[0].to, [{ email: "customer@example.com" }]);
    assert.deepEqual(request.body.recipients[0].variables, { company_name: "SARINE", otp: "123456" });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MSG91_EMAIL_ENABLED = "false";
    delete process.env.MSG91_EMAIL_AUTH_KEY;
    delete process.env.MSG91_EMAIL_DOMAIN;
    delete process.env.MSG91_EMAIL_FROM;
    delete process.env.MSG91_EMAIL_FROM_NAME;
    delete process.env.MSG91_EMAIL_TEMPLATE_ID;
  }
});

test("MSG91 refuses a sender address outside the configured verified domain", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fetch must not be called for a mismatched sender domain"); };
  try {
    process.env.MSG91_EMAIL_ENABLED = "true";
    process.env.MSG91_EMAIL_AUTH_KEY = "test-msg91-auth-key";
    process.env.MSG91_EMAIL_DOMAIN = "mail.sarine.example";
    process.env.MSG91_EMAIL_FROM = "no-reply@temporary.hostingersite.com";
    await assert.rejects(
      deliverCustomerOtp("email", "customer@example.com", "123456", "login"),
      /must use the verified sending domain/
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env.MSG91_EMAIL_ENABLED = "false";
    delete process.env.MSG91_EMAIL_AUTH_KEY;
    delete process.env.MSG91_EMAIL_DOMAIN;
    delete process.env.MSG91_EMAIL_FROM;
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
    delete process.env.FAST2SMS_API_KEY;
    delete process.env.FAST2SMS_OTP_ID;
  }
});
