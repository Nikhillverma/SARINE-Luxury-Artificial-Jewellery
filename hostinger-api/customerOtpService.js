import crypto from "node:crypto";
import { pool } from "./db.js";
import { CUSTOMER_OTP_POLICY, normalizePhone, createOtp, hashOtp, safeOtpEqual } from "./customerOtpPolicy.js";
export { CUSTOMER_OTP_POLICY, normalizePhone, createOtp, hashOtp, safeOtpEqual };

export function getCustomerOtpProvider(method) {
  if (method === "email") return "MSG91";
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

function getMsg91EmailConfig() {
  const enabled = process.env.MSG91_EMAIL_ENABLED === "true";
  if (!enabled) {
    throw new Error("MSG91 email OTP delivery is disabled until the SARINE sending domain is verified and explicitly enabled.");
  }

  const authKey = String(process.env.MSG91_EMAIL_AUTH_KEY || "").trim();
  const domain = String(process.env.MSG91_EMAIL_DOMAIN || "").trim().toLowerCase();
  const from = String(process.env.MSG91_EMAIL_FROM || "").trim().toLowerCase();
  const fromName = String(process.env.MSG91_EMAIL_FROM_NAME || "SARINE").trim();
  const templateId = String(process.env.MSG91_EMAIL_TEMPLATE_ID || "global_otp").trim();

  if (!authKey) throw new Error("MSG91 email OTP delivery is not configured.");
  if (!domain || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    throw new Error("A verified SARINE MSG91 sending domain and sender address are required.");
  }
  if (from.split("@")[1] !== domain) {
    throw new Error("MSG91 sender address must use the verified sending domain.");
  }
  if (!templateId) throw new Error("MSG91 email template is not configured.");

  return { authKey, domain, from, fromName, templateId };
}

async function sendEmail(to, otp) {
  const config = getMsg91EmailConfig();
  const response = await fetch("https://control.msg91.com/api/v5/email/send", {
    method: "POST",
    headers: {
      authkey: config.authKey,
      accept: "application/json",
      "content-type": "application/json"
    },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      recipients: [{
        to: [{ email: to }],
        variables: {
          company_name: "SARINE",
          otp: String(otp)
        }
      }],
      from: {
        name: config.fromName,
        email: config.from
      },
      domain: config.domain,
      template_id: config.templateId
    })
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.status !== "success" || result?.hasError === true) {
    throw new Error("MSG91 email delivery request was rejected.");
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
    await sendEmail(identifier, otp);
    return "MSG91";
  }
  if (method === "phone") {
    await sendSms(identifier, otp);
    return "Fast2SMS";
  }
  throw new Error("Unsupported OTP delivery method.");
}
