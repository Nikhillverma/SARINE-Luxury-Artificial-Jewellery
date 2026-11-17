import crypto from "node:crypto";
import { pool } from "./db.js";

const OTP_TTL_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 45;
const MAX_ATTEMPTS = 5;

function otpSecret() {
  const secret = process.env.CUSTOMER_OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CUSTOMER_OTP_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : "";
}

export function createOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(challengeId, otp) {
  return crypto.createHmac("sha256", otpSecret()).update(`${challengeId}:${otp}`).digest("hex");
}

export function safeOtpEqual(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string" || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

let schemaReady;
export async function ensureCustomerOtpSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
  const [columns] = await pool.execute(
    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME IN ('email', 'email_normalized', 'phone', 'phone_normalized')"
  );
  const byName = new Map(columns.map((column) => [column.COLUMN_NAME, column]));
  for (const name of ["email", "email_normalized"]) {
    const column = byName.get(name);
    if (column && column.IS_NULLABLE !== "YES") {
      const safeType = String(column.COLUMN_TYPE).replace(/[^a-zA-Z0-9(), ']/g, "");
      await pool.query(`ALTER TABLE customers MODIFY COLUMN \`${name}\` ${safeType} NULL`);
    }
  }
  if (!byName.has("phone_normalized")) {
    await pool.query("ALTER TABLE customers ADD COLUMN phone_normalized VARCHAR(20) NULL");
  }
  if (!byName.has("google_sub")) {
    await pool.query("ALTER TABLE customers ADD COLUMN google_sub VARCHAR(255) NULL");
  }
  const [indexes] = await pool.execute(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'uq_customers_phone_normalized'"
  );
  if (!indexes.length) {
    await pool.query("CREATE UNIQUE INDEX uq_customers_phone_normalized ON customers (phone_normalized)");
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_auth_challenges (
      id CHAR(36) NOT NULL PRIMARY KEY,
      identifier VARCHAR(254) NOT NULL,
      method VARCHAR(10) NOT NULL,
      purpose VARCHAR(24) NOT NULL,
      otp_hash CHAR(64) NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME(3) NOT NULL,
      consumed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_customer_auth_challenge_lookup (identifier, purpose, created_at),
      INDEX idx_customer_auth_challenge_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_password_resets (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      customer_id CHAR(36) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_customer_password_reset_customer (customer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  })().catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

async function sendEmail(to, otp, purpose) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SARINE_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email OTP delivery is not configured.");
  const subject = purpose === "password_reset" ? "Reset your SARINE password" : "Your SARINE verification code";
  const action = purpose === "password_reset" ? "reset your password" : "sign in to your SARINE account";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#302438;max-width:520px;margin:auto;padding:28px"><h1 style="color:#563568;letter-spacing:5px;font-weight:400">SARINE</h1><p>Your verification code to ${action} is:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#563568">${otp}</p><p>This code expires in 5 minutes. Never share it with anyone.</p><p style="color:#8A7B90;font-size:12px">If you did not request this code, you can safely ignore this email.</p></div>`
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email delivery failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

async function sendSms(phone, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) throw new Error("SMS OTP delivery is not configured.");
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", `91${phone}`);
  url.searchParams.set("authkey", authKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp, otp_expiry: "5", realTimeResponse: "1" })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SMS delivery failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const result = await response.json().catch(() => ({}));
  if (result?.type === "error" || result?.status === "error") {
    throw new Error("SMS provider rejected the OTP request.");
  }
}

export async function deliverCustomerOtp(method, identifier, otp, purpose) {
  if (method === "email") return sendEmail(identifier, otp, purpose);
  if (method === "phone") return sendSms(identifier, otp);
  throw new Error("Unsupported OTP delivery method.");
}

export const CUSTOMER_OTP_POLICY = Object.freeze({
  ttlMinutes: OTP_TTL_MINUTES,
  resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
  maxAttempts: MAX_ATTEMPTS
});
