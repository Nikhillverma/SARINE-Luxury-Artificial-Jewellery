import crypto from "node:crypto";
import { pool } from "./db.js";
import { CUSTOMER_OTP_POLICY, normalizePhone, createOtp, hashOtp, safeOtpEqual } from "./customerOtpPolicy.js";
export { CUSTOMER_OTP_POLICY, normalizePhone, createOtp, hashOtp, safeOtpEqual };

export function getCustomerOtpProvider(method) {
  if (method === "email") return "Brevo";
  if (method === "phone") return "Fast2SMS";
  return "unknown";
}

let schemaReady;
export async function ensureCustomerOtpSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
  const [columns] = await pool.execute(
    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME IN ('email', 'email_normalized', 'phone', 'phone_normalized', 'google_sub')"
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
  const [googleIndexes] = await pool.execute("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND INDEX_NAME = 'uq_customers_google_sub'");
  if (!googleIndexes.length) await pool.query("CREATE UNIQUE INDEX uq_customers_google_sub ON customers (google_sub)");
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
    CREATE TABLE IF NOT EXISTS customer_auth_delivery_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      challenge_id CHAR(36) NULL,
      method VARCHAR(10) NOT NULL,
      purpose VARCHAR(24) NOT NULL,
      provider VARCHAR(20) NOT NULL,
      identifier_masked VARCHAR(254) NOT NULL,
      status VARCHAR(12) NOT NULL,
      failure_code VARCHAR(40) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_customer_auth_delivery_recent (created_at, status),
      INDEX idx_customer_auth_delivery_method (method, created_at)
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

function getBrevoSender() {
  const email = String(process.env.SARINE_EMAIL_FROM || "").trim();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    throw new Error("A verified SARINE_EMAIL_FROM address is required for email OTP delivery.");
  }
  return { name: "SARINE", email };
}

async function sendEmail(to, otp, purpose) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Brevo email OTP delivery is not configured.");
  const subject = purpose === "password_reset" ? "Reset your SARINE password" : "Your SARINE verification code";
  const action = purpose === "password_reset" ? "reset your SARINE password" : "sign in to your SARINE account";
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      sender: getBrevoSender(),
      to: [{ email: to }],
      subject,
      htmlContent: `<div style="font-family:Arial,sans-serif;color:#302438;max-width:520px;margin:auto;padding:28px"><h1 style="color:#563568;letter-spacing:5px;font-weight:400">SARINE</h1><p>Your verification code to ${action} is:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#563568">${otp}</p><p>This code expires in 5 minutes. Never share it with anyone.</p><p style="color:#8A7B90;font-size:12px">If you did not request this code, you can safely ignore this email.</p></div>`
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo email delivery failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}

async function sendSms(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const otpId = process.env.FAST2SMS_OTP_ID;
  if (!apiKey || !otpId) throw new Error("Fast2SMS phone OTP delivery is not configured.");
  const response = await fetch("https://www.fast2sms.com/dev/otp/send", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      mobile: phone,
      otp_id: otpId,
      otp_length: 6,
      otp_expiry: 5,
      otp: String(otp)
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.return !== true) {
    throw new Error("Fast2SMS rejected the phone OTP request.");
  }
}

export async function deliverCustomerOtp(method, identifier, otp, purpose) {
  if (method === "email") {
    await sendEmail(identifier, otp, purpose);
    return "Brevo";
  }
  if (method === "phone") {
    await sendSms(identifier, otp);
    return "Fast2SMS";
  }
  throw new Error("Unsupported OTP delivery method.");
}
