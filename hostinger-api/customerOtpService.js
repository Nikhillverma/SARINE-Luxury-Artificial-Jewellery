import crypto from "node:crypto";
import { pool } from "./db.js";
import { CUSTOMER_OTP_POLICY, normalizePhone, createOtp, hashOtp, safeOtpEqual } from "./customerOtpPolicy.js";
export { CUSTOMER_OTP_POLICY, normalizePhone, createOtp, hashOtp, safeOtpEqual };

export function getCustomerOtpProvider(method) {
  if (method === "email") return "MSG91";
  if (method === "phone") return "MSG91";
  return "unknown";
}

export function getCustomerOtpAvailability() {
  const domain = String(process.env.MSG91_EMAIL_DOMAIN || "").trim().toLowerCase();
  const from = String(process.env.MSG91_EMAIL_FROM || "").trim().toLowerCase();
  const emailReady = process.env.MSG91_EMAIL_ENABLED === "true" &&
    Boolean(String(process.env.MSG91_EMAIL_AUTH_KEY || "").trim()) && Boolean(domain) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) && from.split("@")[1] === domain &&
    Boolean(String(process.env.MSG91_EMAIL_TEMPLATE_ID || "global_otp").trim());
  return {
    email: { enabled: emailReady, provider: "MSG91", reason: emailReady ? null : "Email verification will be available after SARINE's sending domain is verified and email delivery is enabled." },
    phone: { enabled: false, provider: "MSG91", reason: "Phone verification is not enabled yet; SMS route approval and cost confirmation are pending." },
    google: { enabled: Boolean(process.env.GOOGLE_CLIENT_ID) }
  };
}

let schemaReady;
export async function assertCustomerOtpSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    // Use database-local SHOW statements instead of information_schema.
    // Some managed-hosting database users cannot read system metadata schemas
    // even when they have full privileges on their application database.
    const [customerColumns] = await pool.query("SHOW COLUMNS FROM customers");
    const customerByName = new Map(customerColumns.map((column) => [column.Field, column]));
    for (const required of ["id", "email", "email_normalized", "phone", "phone_normalized", "google_sub"]) {
      if (!customerByName.has(required)) {
        throw new Error(`Customer authentication migration is incomplete: customers.${required} is missing. No automatic database changes were attempted.`);
      }
    }
    for (const name of ["email", "email_normalized"]) {
      if (customerByName.get(name).Null !== "YES") {
        throw new Error(`Customer authentication migration is incomplete: customers.${name} must allow NULL for phone-only accounts.`);
      }
    }

    const requiredTables = [
      "customer_auth_challenges",
      "customer_auth_delivery_events",
      "customer_password_resets"
    ];
    for (const tableName of requiredTables) {
      const [tables] = await pool.query(`SHOW TABLES LIKE '${tableName}'`);
      if (!tables.length) {
        throw new Error(`Customer authentication migration is incomplete: table ${tableName} is missing. No automatic database changes were attempted.`);
      }
    }

    const [challengeColumns] = await pool.query(
      "SHOW COLUMNS FROM customer_auth_challenges LIKE 'customer_id'"
    );
    if (!challengeColumns.length) {
      throw new Error("Customer authentication migration is incomplete: customer_auth_challenges.customer_id is missing.");
    }

    const [indexes] = await pool.query("SHOW INDEX FROM customers");
    const requiredUniqueIndexes = ["uq_customers_phone_normalized", "uq_customers_google_sub"];
    for (const name of requiredUniqueIndexes) {
      const index = indexes.find((entry) => entry.Key_name === name && Number(entry.Non_unique) === 0);
      if (!index) {
        throw new Error(`Customer authentication migration is incomplete: unique index ${name} is missing.`);
      }
    }
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


export async function deliverCustomerOtp(method, identifier, otp, purpose) {
  if (method === "email") {
    await sendEmail(identifier, otp);
    return "MSG91";
  }
  if (method === "phone") {
    throw new Error("MSG91 phone OTP delivery is not enabled. Configure and approve the MSG91 SMS route before enabling customer phone login.");
  }
  throw new Error("Unsupported OTP delivery method.");
}
