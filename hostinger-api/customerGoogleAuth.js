import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { shouldUseSecureSessionCookie } from "./sessionCookiePolicy.js";
import { normalizeCustomerEmail } from "./customerValidation.js";
import { ensureCustomerOtpSchema } from "./customerOtpService.js";

const router = Router();
const COOKIE_NAME = "sarine_customer_session";

function hashToken(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
function safeCustomer(row) { return { id: row.id, name: row.name, email: row.email || "", phone: row.phone || "" }; }
async function createSession(customerId, res) {
  const token = crypto.randomBytes(32).toString("hex");
  await pool.execute("INSERT INTO customer_sessions (id, customer_id, expires_at) VALUES (?, ?, ?)", [
    hashToken(token), customerId, new Date(Date.now() + 30 * 86400000)
  ]);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "lax",
    path: "/api",
    maxAge: 30 * 86400000
  });
}

router.post("/google", async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");
    await ensureCustomerOtpSchema();
    const credential = String(req.body?.credential || "");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || !credential || credential.length > 10000) {
      return res.status(503).json({ error: "Google sign-in is not configured yet." });
    }
    const response = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
    const profile = await response.json();
    if (profile.aud !== clientId || !["accounts.google.com", "https://accounts.google.com"].includes(profile.iss) ||
        profile.email_verified !== "true" || !profile.sub || !profile.email) {
      return res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
    }
    const email = normalizeCustomerEmail(profile.email);
    if (!email) return res.status(401).json({ error: "Google did not provide a verified email address." });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [googleRows] = await connection.execute(
      "SELECT id, name, email, phone, status, google_sub FROM customers WHERE google_sub = ? LIMIT 1 FOR UPDATE",
      [profile.sub]
    );
    const [emailRows] = googleRows.length ? [googleRows] : await connection.execute(
      "SELECT id, name, email, phone, status, google_sub FROM customers WHERE email_normalized = ? LIMIT 1 FOR UPDATE",
      [email]
    );
    let customer = emailRows[0] || null;
    let created = false;
    if (customer && customer.status !== "active") {
      await connection.rollback();
      return res.status(403).json({ error: "This account is not currently available. Please contact SARINE support." });
    }
    if (customer?.google_sub && customer.google_sub !== profile.sub) {
      await connection.rollback();
      return res.status(409).json({ error: "This email is linked to a different Google account." });
    }
    if (!customer) {
      const id = crypto.randomUUID();
      const name = String(profile.name || profile.given_name || "SARINE Customer").trim().slice(0, 120);
      const salt = await bcrypt.genSalt(12);
      const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(48).toString("hex"), salt);
      await connection.execute(
        "INSERT INTO customers (id, email, email_normalized, name, password_hash, password_salt, password_scheme, google_sub, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'bcrypt', ?, 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
        [id, email, email, name, unusablePasswordHash, salt, profile.sub]
      );
      customer = { id, name, email, phone: "", status: "active", google_sub: profile.sub };
      created = true;
    } else if (!customer.google_sub) {
      await connection.execute("UPDATE customers SET google_sub = ? WHERE id = ? AND google_sub IS NULL", [profile.sub, customer.id]);
    }
    await connection.execute("UPDATE customers SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?", [customer.id]);
    await connection.commit();
    await createSession(customer.id, res);
    return res.json({ success: true, customer: safeCustomer(customer), created });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "This Google account is already linked to another customer." });
    return next(error);
  } finally {
    connection?.release();
  }
});

export default router;
