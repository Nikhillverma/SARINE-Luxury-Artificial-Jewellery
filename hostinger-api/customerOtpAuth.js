import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { shouldUseSecureSessionCookie } from "./sessionCookiePolicy.js";
import { normalizeCustomerEmail } from "./customerValidation.js";
import { normalizePhone, createOtp, hashOtp, safeOtpEqual, assertCustomerOtpSchema, deliverCustomerOtp, getCustomerOtpProvider, getCustomerOtpAvailability, CUSTOMER_OTP_POLICY } from "./customerOtpService.js";

const router = Router();
const COOKIE_NAME = "sarine_customer_session";
const SESSION_DAYS = 30;
const requestLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false });

router.get("/methods", (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json(getCustomerOtpAvailability());
});

function hashToken(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: shouldUseSecureSessionCookie(), sameSite: "lax", path: "/api", maxAge: SESSION_DAYS * 86400000 });
}
function safeCustomer(row) { return { id: row.id, name: row.name, email: row.email || "", phone: row.phone || "" }; }
async function createSession(customerId, res) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await pool.execute("INSERT INTO customer_sessions (id, customer_id, expires_at) VALUES (?, ?, ?)", [hashToken(token), customerId, expiresAt]);
  setSessionCookie(res, token);
}
function readCustomerSessionToken(req) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
async function getSessionCustomer(req, connection = pool) {
  const token = readCustomerSessionToken(req);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const [rows] = await connection.execute(
    "SELECT c.id, c.name, c.email, c.phone, c.status FROM customer_sessions s INNER JOIN customers c ON c.id = s.customer_id WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3) AND c.status = 'active' LIMIT 1",
    [hashToken(token)]
  );
  if (!rows.length) return null;
  await connection.execute("UPDATE customer_sessions SET last_used_at = UTC_TIMESTAMP(3) WHERE id = ?", [hashToken(token)]);
  return rows[0];
}

function resolveIdentifier(method, value) {
  if (method === "email") return normalizeCustomerEmail(value);
  if (method === "phone") return normalizePhone(value);
  return "";
}
async function findCustomer(method, identifier, connection = pool) {
  const sql = method === "email"
    ? "SELECT id, name, email, phone, status, google_sub FROM customers WHERE email_normalized = ? LIMIT 1"
    : "SELECT id, name, email, phone, status, google_sub FROM customers WHERE phone_normalized = ? OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', ''), '/', '') IN (?, ?) LIMIT 2";
  const values = method === "email" ? [identifier] : [identifier, identifier, "91" + identifier];
  const [rows] = await connection.execute(sql, values);
  if (method === "phone" && rows.length > 1) return { ambiguous: true };
  return rows[0] || null;
}
function maskIdentifier(method, identifier) {
  if (method === "email") {
    const [local, domain] = identifier.split("@");
    return (local?.slice(0, 1) || "*") + "***@" + (domain || "");
  }
  return "******" + identifier.slice(-2);
}

async function createChallenge(method, identifier, purpose) {
  const connection = await pool.getConnection();
  let lockAcquired = false;
  let challenge;
  try {
    // A per-identifier advisory lock prevents concurrent requests bypassing
    // the resend cooldown or creating multiple simultaneously valid codes.
    const [locks] = await connection.execute(
      "SELECT GET_LOCK(SHA2(CONCAT(?, ':', ?), 256), 5) AS acquired",
      [identifier, purpose]
    );
    lockAcquired = Number(locks[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error("OTP request is busy. Please try again shortly.");

    await connection.beginTransaction();
    const [recent] = await connection.execute(
      "SELECT COUNT(*) AS total, MAX(created_at) AS created_at FROM customer_auth_challenges WHERE identifier = ? AND purpose = ? AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 HOUR)",
      [identifier, purpose]
    );
    if (Number(recent[0]?.total) >= 5) {
      await connection.rollback();
      return { cooldown: 3600 };
    }
    if (recent[0]?.created_at) {
      const elapsed = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
      if (elapsed < CUSTOMER_OTP_POLICY.resendCooldownSeconds) {
        await connection.rollback();
        return { cooldown: Math.ceil(CUSTOMER_OTP_POLICY.resendCooldownSeconds - elapsed) };
      }
    }
    await connection.execute("DELETE FROM customer_auth_challenges WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)");
    const otp = createOtp();
    const id = crypto.randomUUID();
    await connection.execute("UPDATE customer_auth_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE identifier = ? AND purpose = ? AND consumed_at IS NULL", [identifier, purpose]);
    await connection.execute("INSERT INTO customer_auth_challenges (id, identifier, method, purpose, otp_hash, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 5 MINUTE))", [id, identifier, method, purpose, hashOtp(id, otp)]);
    await connection.commit();
    challenge = { id, otp };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    if (lockAcquired) {
      await connection.execute("SELECT RELEASE_LOCK(SHA2(CONCAT(?, ':', ?), 256))", [identifier, purpose]).catch(() => {});
    }
    connection.release();
  }
  const provider = getCustomerOtpProvider(method);
  try {
    await deliverCustomerOtp(method, identifier, challenge.otp, purpose);
    await pool.execute("INSERT INTO customer_auth_delivery_events (challenge_id, method, purpose, provider, identifier_masked, status) VALUES (?, ?, ?, ?, ?, 'sent')", [challenge.id, method, purpose, provider, maskIdentifier(method, identifier)]);
  } catch (error) {
    await pool.execute("UPDATE customer_auth_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE id = ?", [challenge.id]);
    const message = String(error?.message || "");
    const failureCode = message.includes("not configured") || message.includes("disabled") ? "provider_not_configured" : "provider_delivery_failed";
    await pool.execute("INSERT INTO customer_auth_delivery_events (challenge_id, method, purpose, provider, identifier_masked, status, failure_code) VALUES (?, ?, ?, ?, ?, 'failed', ?)", [challenge.id, method, purpose, provider, maskIdentifier(method, identifier), failureCode]);
    throw error;
  }
  return { sent: true, challengeId: challenge.id };
}

router.post("/otp/request", requestLimiter, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    await assertCustomerOtpSchema();
    const method = String(req.body?.method || "").toLowerCase();
    const identifier = resolveIdentifier(method, req.body?.identifier);
    if (!identifier) return res.status(400).json({ error: method === "phone" ? "Enter a valid 10-digit Indian mobile number." : "Enter a valid email address." });
    const result = await createChallenge(method, identifier, "login");
    if (result.cooldown) return res.status(429).json({ error: `Please wait ${result.cooldown} seconds before requesting another code.`, retryAfterSeconds: result.cooldown });
    return res.json({ success: true, challengeId: result.challengeId, expiresInSeconds: 300, resendAfterSeconds: CUSTOMER_OTP_POLICY.resendCooldownSeconds });
  } catch (error) { return next(error); }
});

router.post("/otp/verify", verifyLimiter, async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");
    await assertCustomerOtpSchema();
    const challengeId = String(req.body?.challengeId || "");
    const otp = String(req.body?.otp || "");
    const name = String(req.body?.name || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: "Enter the six-digit verification code." });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [challenges] = await connection.execute(
      "SELECT * FROM customer_auth_challenges WHERE id = ? AND purpose = 'login' AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE",
      [challengeId]
    );
    if (!challenges.length) {
      await connection.rollback();
      return res.status(400).json({ error: "This code has expired or is no longer valid. Request a new code." });
    }
    const challenge = challenges[0];
    if (Number(challenge.attempts) >= CUSTOMER_OTP_POLICY.maxAttempts) {
      await connection.execute("UPDATE customer_auth_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE id = ?", [challengeId]);
      await connection.commit();
      return res.status(429).json({ error: "Too many incorrect codes. Request a new one." });
    }
    if (!safeOtpEqual(challenge.otp_hash, hashOtp(challengeId, otp))) {
      await connection.execute("UPDATE customer_auth_challenges SET attempts = attempts + 1 WHERE id = ?", [challengeId]);
      await connection.commit();
      return res.status(400).json({ error: "The verification code is incorrect." });
    }
    let customer = await findCustomer(challenge.method, challenge.identifier, connection);
    let created = false;
    if (customer?.ambiguous) { await connection.rollback(); return res.status(409).json({ error: "We could not safely match this mobile number to one customer account. Please contact SARINE support." }); }
    if (customer && customer.status !== "active") {
      await connection.rollback();
      return res.status(403).json({ error: "This account is not currently available. Please contact SARINE support." });
    }
    if (!customer) {
      if (name.length < 2 || name.length > 120) {
        await connection.rollback();
        return res.status(422).json({ error: "Please enter your full name to create your SARINE account.", requiresName: true });
      }
      const id = crypto.randomUUID();
      const email = challenge.method === "email" ? challenge.identifier : null;
      const phone = challenge.method === "phone" ? challenge.identifier : null;
      const salt = await bcrypt.genSalt(12);
      const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(48).toString("hex"), salt);
      await connection.execute(
        `INSERT INTO customers
         (id, email, email_normalized, phone, phone_normalized, name, password_hash, password_salt, password_scheme, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bcrypt', 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [id, email, email, phone, phone, name, unusablePasswordHash, salt]
      );
      customer = { id, name, email: email || "", phone: phone || "", status: "active" };
      created = true;
    }
    if (challenge.method === "phone") await connection.execute("UPDATE customers SET phone_normalized = ? WHERE id = ? AND (phone_normalized IS NULL OR phone_normalized = ?)", [challenge.identifier, customer.id, ""]);
    await connection.execute("UPDATE customer_auth_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE id = ?", [challengeId]);
    await connection.execute("UPDATE customers SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?", [customer.id]);
    await connection.commit();
    await createSession(customer.id, res);
    return res.json({ success: true, customer: safeCustomer(customer), created });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This contact is already linked to another customer account. Please sign in using that account." });
    return next(error);
  } finally { connection?.release(); }
});

router.post("/password/forgot/request", requestLimiter, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    await assertCustomerOtpSchema();
    const method = String(req.body?.method || "").toLowerCase();
    const identifier = resolveIdentifier(method, req.body?.identifier);
    if (!identifier) return res.status(400).json({ error: "Enter a valid registered email address or mobile number." });
    const customer = await findCustomer(method, identifier);
    let challengeId = crypto.randomUUID();
    if (customer?.status === "active") {
      const result = await createChallenge(method, identifier, "password_reset");
      if (!result.cooldown) challengeId = result.challengeId;
    }
    return res.json({ success: true, challengeId, message: "If an account matches those details, a verification code has been sent." });
  } catch (error) { return next(error); }
});

router.post("/password/forgot/verify", verifyLimiter, async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");
    await assertCustomerOtpSchema();
    const challengeId = String(req.body?.challengeId || "");
    const otp = String(req.body?.otp || "");
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: "Enter the six-digit verification code." });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT * FROM customer_auth_challenges WHERE id = ? AND purpose = 'password_reset' AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE",
      [challengeId]
    );
    const challenge = rows[0];
    if (!challenge || Number(challenge.attempts) >= CUSTOMER_OTP_POLICY.maxAttempts || !safeOtpEqual(challenge.otp_hash, hashOtp(challengeId, otp))) {
      if (challenge) {
        const nextAttempts = Number(challenge.attempts) + 1;
        await connection.execute("UPDATE customer_auth_challenges SET attempts = ?, consumed_at = CASE WHEN ? >= ? THEN UTC_TIMESTAMP(3) ELSE consumed_at END WHERE id = ?", [nextAttempts, nextAttempts, CUSTOMER_OTP_POLICY.maxAttempts, challengeId]);
      }
      await connection.commit();
      return res.status(400).json({ error: "The verification code is invalid or expired. Request a new one." });
    }
    const customer = await findCustomer(challenge.method, challenge.identifier, connection);
    if (!customer || customer.status !== "active") {
      await connection.execute("UPDATE customer_auth_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE id = ?", [challengeId]);
      await connection.commit();
      return res.status(400).json({ error: "The verification code is invalid or expired. Request a new one." });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    await connection.execute("INSERT INTO customer_password_resets (token_hash, customer_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE))", [hashToken(resetToken), customer.id]);
    await connection.execute("UPDATE customer_auth_challenges SET consumed_at = UTC_TIMESTAMP(3) WHERE id = ?", [challengeId]);
    await connection.commit();
    return res.json({ success: true, resetToken, expiresInSeconds: 600 });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return next(error);
  } finally { connection?.release(); }
});

router.post("/password/forgot/reset", requestLimiter, async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");
    await assertCustomerOtpSchema();
    const token = String(req.body?.resetToken || "");
    const password = String(req.body?.password || "");
    if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 8 || password.length > 128) return res.status(400).json({ error: "Use a valid recovery link and a password of at least 8 characters." });
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT customer_id FROM customer_password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE", [hashToken(token)]);
    if (!rows.length) {
      await connection.rollback();
      return res.status(400).json({ error: "This password recovery session has expired. Please request a new code." });
    }
    const customerId = rows[0].customer_id;
    await connection.execute("UPDATE customers SET password_hash = ?, password_salt = ?, password_scheme = 'bcrypt', updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [passwordHash, salt, customerId]);
    // A successful reset invalidates every outstanding reset token for this account.
    await connection.execute("UPDATE customer_password_resets SET used_at = UTC_TIMESTAMP(3) WHERE customer_id = ? AND used_at IS NULL", [customerId]);
    await connection.execute("DELETE FROM customer_sessions WHERE customer_id = ?", [customerId]);
    await connection.commit();
    return res.json({ success: true, message: "Your password has been updated. Please sign in again." });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return next(error);
  } finally { connection?.release(); }
});

export default router;
