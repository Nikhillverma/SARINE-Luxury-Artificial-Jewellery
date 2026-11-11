import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { verifyFirebaseScrypt } from "./lib/firebaseScrypt.js";

const router = Router();
const COOKIE_NAME = "sarine_customer_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again later." }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many account creation attempts. Please try again later." }
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function readCookie(req) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/customer",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/customer"
  });
}

function safeCustomer(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || "",
    emailVerified: Boolean(row.email_verified_at)
  };
}

function firebaseScryptConfig() {
  const { FIREBASE_SCRYPT_SIGNER_KEY, FIREBASE_SCRYPT_SALT_SEPARATOR } = process.env;
  const memCost = Number(process.env.FIREBASE_SCRYPT_MEM_COST);
  const rounds = Number(process.env.FIREBASE_SCRYPT_ROUNDS);
  if (!FIREBASE_SCRYPT_SIGNER_KEY || !FIREBASE_SCRYPT_SALT_SEPARATOR ||
      !Number.isInteger(memCost) || !Number.isInteger(rounds)) {
    throw new Error("Firebase SCRYPT verification is not configured.");
  }
  return {
    signerKey: FIREBASE_SCRYPT_SIGNER_KEY,
    saltSeparator: FIREBASE_SCRYPT_SALT_SEPARATOR,
    memCost,
    rounds
  };
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function issueSession(customer, res) {
  const token = createSessionToken();
  const sessionId = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.execute(
    `INSERT INTO customer_sessions (id, customer_id, expires_at, created_at, last_used_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
    [sessionId, customer.id, expiresAt]
  );
  setSessionCookie(res, token);
}

export async function requireCustomerAuth(req, res, next) {
  const token = readCookie(req);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(401).json({ authenticated: false, error: "Sign in required." });
  }

  try {
    const sessionId = hashToken(token);
    const [rows] = await pool.execute(
      `SELECT c.id, c.email, c.name, c.phone, c.email_verified_at,
              c.status, s.id AS session_id
       FROM customer_sessions s
       INNER JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP(3)
         AND c.status = 'active'
       LIMIT 1`,
      [sessionId]
    );

    if (!rows.length) {
      clearSessionCookie(res);
      return res.status(401).json({ authenticated: false, error: "Session expired. Please sign in again." });
    }

    await pool.execute(
      "UPDATE customer_sessions SET last_used_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [sessionId]
    );
    req.customer = safeCustomer(rows[0]);
    next();
  } catch (error) {
    next(error);
  }
}

router.post("/register", signupLimiter, async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || "").trim();
  const password = String(req.body?.password || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (name.length < 2 || name.length > 255) {
    return res.status(400).json({ error: "Enter your full name." });
  }
  if (password.length < 8 || password.length > 4096) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const [existing] = await pool.execute(
      "SELECT id FROM customers WHERE email_normalized = ? LIMIT 1",
      [email]
    );
    if (existing.length) {
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.execute(
      `INSERT INTO customers
       (id, email, email_normalized, name, password_hash, password_salt,
        password_scheme, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 'bcrypt', 'active', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [id, email, email, name, passwordHash]
    );

    const customer = { id, email, name, phone: "", email_verified_at: null };
    await issueSession(customer, res);
    return res.status(201).json({ success: true, customer: safeCustomer(customer) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }
    next(error);
  }
});

router.post("/login", loginLimiter, async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      !password || password.length > 4096) {
    return res.status(400).json({ error: "Enter a valid email address and password." });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, email, name, phone, password_hash, password_salt,
              password_scheme, email_verified_at, status
       FROM customers WHERE email_normalized = ? LIMIT 1`,
      [email]
    );
    const customer = rows[0];

    // Keep the response identical for missing, disabled, and incorrect-password accounts.
    if (!customer || customer.status !== "active" || !customer.password_hash) {
      return res.status(401).json({ error: "Invalid email address or password." });
    }

    let passwordMatches = false;
    if (customer.password_scheme === "firebase_scrypt") {
      let config;
      try { config = firebaseScryptConfig(); } catch {
        return res.status(503).json({ error: "Secure sign-in is temporarily unavailable. Please contact SARINE support." });
      }
      passwordMatches = await verifyFirebaseScrypt({
        password,
        passwordHash: customer.password_hash,
        passwordSalt: customer.password_salt,
        config
      });
    } else if (customer.password_scheme === "bcrypt" || !customer.password_scheme) {
      passwordMatches = await bcrypt.compare(password, customer.password_hash);
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email address or password." });
    }

    // Upgrade a legacy Firebase hash only after its password has been verified.
    if (customer.password_scheme === "firebase_scrypt") {
      const upgradedHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await pool.execute(
        `UPDATE customers
         SET password_hash = ?, password_salt = NULL, password_scheme = 'bcrypt',
             last_login_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ? AND password_scheme = 'firebase_scrypt'`,
        [upgradedHash, customer.id]
      );
    } else {
      await pool.execute(
        "UPDATE customers SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
        [customer.id]
      );
    }

    await issueSession(customer, res);
    return res.json({ success: true, customer: safeCustomer(customer) });
  } catch (error) {
    next(error);
  }
});

router.get("/session", requireCustomerAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ authenticated: true, customer: req.customer });
});

router.post("/logout", async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    const token = readCookie(req);
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      await pool.execute("DELETE FROM customer_sessions WHERE id = ?", [hashToken(token)]);
    }
    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", requireCustomerAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone,
              o.shipping_address, o.subtotal, o.shipping_fee, o.total, o.payment_method,
              o.payment_status, o.order_status, o.created_at,
              o.cancellation_reason, o.cancelled_at,
              oi.product_id, oi.product_name, oi.unit_price, oi.quantity, oi.image
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC, oi.source_line ASC`,
      [req.customer.id]
    );

    const orders = new Map();
    for (const row of rows) {
      if (!orders.has(row.id)) {
        let shippingAddress = {};
        try {
          shippingAddress = typeof row.shipping_address === "string"
            ? JSON.parse(row.shipping_address) : (row.shipping_address || {});
        } catch {}
        orders.set(row.id, {
          id: row.id,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          customerEmail: row.customer_email,
          customerPhone: row.customer_phone,
          shippingAddress,
          subtotal: Number(row.subtotal),
          shippingFee: Number(row.shipping_fee),
          total: Number(row.total),
          paymentMethod: row.payment_method,
          paymentStatus: row.payment_status,
          orderStatus: row.order_status,
          createdAt: row.created_at,
          cancellationReason: row.cancellation_reason || null,
          cancelledAt: row.cancelled_at || null,
          lines: []
        });
      }
      if (row.product_id) {
        orders.get(row.id).lines.push({
          productId: row.product_id,
          name: row.product_name,
          unitPrice: Number(row.unit_price),
          quantity: Number(row.quantity),
          image: row.image || ""
        });
      }
    }
    res.set("Cache-Control", "no-store");
    return res.json({ orders: [...orders.values()] });
  } catch (error) {
    next(error);
  }
});

export default router;
