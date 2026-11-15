import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { normalizeCustomerEmail } from "./customerValidation.js";

const router = Router();
const COOKIE_NAME = "sarine_customer_session";
const SESSION_DAYS = 30;
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." }
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many account creation attempts. Please try again later." }
});

function readCookie(req) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });
}
function clearCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api"
  });
}
function safeCustomer(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone || "" };
}
async function findSession(req) {
  const token = readCookie(req);
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const sessionId = hashToken(token);
  const [rows] = await pool.execute(
    `SELECT c.id, c.name, c.email, c.phone
     FROM customer_sessions s
     INNER JOIN customers c ON c.id = s.customer_id
     WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP(3) AND c.status = 'active'
     LIMIT 1`,
    [sessionId]
  );
  if (!rows.length) return null;
  await pool.execute(
    "UPDATE customer_sessions SET last_used_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
    [sessionId]
  );
  return rows[0];
}
async function createSession(customerId, res) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.execute(
    "INSERT INTO customer_sessions (id, customer_id, expires_at) VALUES (?, ?, ?)",
    [hashToken(token), customerId, expiresAt]
  );
  setCookie(res, token);
}

// GET /api/customer/auth/orders — only orders explicitly linked to this customer account.
router.get("/orders", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const customer = await findSession(req);
    if (!customer) return res.status(401).json({ error: "Please sign in again." });
    const [rows] = await pool.execute(
      `SELECT id, order_number, customer_name, customer_email, customer_phone,
              shipping_address, subtotal, shipping_fee, total, payment_method,
              payment_status, order_status, courier_name, tracking_number,
              tracking_url, shipped_at, delivered_at, cancelled_at,
              cancellation_reason, refund_needed, refund_amount, created_at
       FROM orders WHERE customer_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 100`,
      [customer.id]
    );
    const ids = rows.map((row) => row.id);
    const itemsByOrder = {};
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [items] = await pool.query(
        `SELECT order_id, product_id, product_name, sku, unit_price, quantity, image
         FROM order_items WHERE order_id IN (${placeholders}) ORDER BY source_line ASC, id ASC`,
        ids
      );
      for (const item of items) {
        (itemsByOrder[item.order_id] ||= []).push({
          productId: item.product_id || "",
          name: item.product_name || "Product",
          image: item.image || "",
          sku: item.sku || undefined,
          unitPrice: Number(item.unit_price) || 0,
          quantity: Number(item.quantity) || 1
        });
      }
    }
    const iso = (value) => value ? new Date(value).toISOString() : undefined;
    const parseAddress = (value) => {
      if (value && typeof value === "object") return value;
      try { return JSON.parse(value || "{}"); } catch { return {}; }
    };
    return res.json({ orders: rows.map((row) => {
      const address = parseAddress(row.shipping_address);
      return {
        id: row.id,
        orderNumber: row.order_number,
        createdAt: iso(row.created_at),
        customer: {
          name: row.customer_name || customer.name,
          email: row.customer_email || customer.email,
          phone: row.customer_phone || customer.phone || ""
        },
        shippingAddress: {
          fullName: address.fullName || row.customer_name || customer.name,
          phone: address.phone || row.customer_phone || "",
          line1: address.line1 || "",
          line2: address.line2 || undefined,
          city: address.city || "",
          state: address.state || "",
          pincode: address.pincode || ""
        },
        lines: itemsByOrder[row.id] || [],
        subtotal: Number(row.subtotal) || 0,
        shippingFee: Number(row.shipping_fee) || 0,
        total: Number(row.total) || 0,
        paymentMethod: row.payment_method || "online",
        paymentStatus: row.payment_status || "pending",
        orderStatus: row.order_status || "pending",
        courierName: row.courier_name || undefined,
        trackingNumber: row.tracking_number || undefined,
        trackingUrl: row.tracking_url || undefined,
        shippedAt: iso(row.shipped_at),
        deliveredAt: iso(row.delivered_at),
        cancelledAt: iso(row.cancelled_at),
        cancellationReason: row.cancellation_reason || undefined,
        refundNeeded: Boolean(row.refund_needed),
        refundAmount: Number(row.refund_amount) || 0
      };
    }) });
  } catch (error) { return next(error); }
});

// POST /api/customer/auth/register
router.post("/register", registrationLimiter, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const name = String(req.body?.name || "").trim();
    const email = normalizeCustomerEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (name.length < 2 || name.length > 120 || !email || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Enter your name, a valid email, and a password of at least 8 characters." });
    }
    const [existing] = await pool.execute(
      "SELECT id FROM customers WHERE email_normalized = ? LIMIT 1", [email]
    );
    if (existing.length) {
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO customers
       (id, email, email_normalized, name, password_hash, password_salt, password_scheme, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'bcrypt', 'active', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [id, email, email, name, passwordHash, salt]
    );
    await createSession(id, res);
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone FROM customers WHERE id = ? LIMIT 1", [id]
    );
    return res.status(201).json({ success: true, customer: safeCustomer(rows[0]) });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    return next(error);
  }
});

// POST /api/customer/auth/login
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const email = normalizeCustomerEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email || !password || password.length > 128) {
      return res.status(400).json({ error: "Enter a valid email and password." });
    }
    const [rows] = await pool.execute(
      "SELECT id, name, email, phone, password_hash, status FROM customers WHERE email_normalized = ? LIMIT 1",
      [email]
    );
    const customer = rows[0];
    const matches = customer?.password_hash ? await bcrypt.compare(password, customer.password_hash) : false;
    if (!customer || customer.status !== "active" || !matches) {
      return res.status(401).json({ error: "Invalid email address or password." });
    }
    await createSession(customer.id, res);
    await pool.execute("UPDATE customers SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [customer.id]);
    return res.json({ success: true, customer: safeCustomer(customer) });
  } catch (error) {
    return next(error);
  }
});

// GET /api/customer/auth/session
router.get("/session", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const customer = await findSession(req);
    if (!customer) {
      clearCookie(res);
      return res.status(401).json({ authenticated: false });
    }
    return res.json({ authenticated: true, customer: safeCustomer(customer) });
  } catch (error) { return next(error); }
});

// POST /api/customer/auth/logout
router.post("/logout", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const token = readCookie(req);
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      await pool.execute("DELETE FROM customer_sessions WHERE id = ?", [hashToken(token)]);
    }
    clearCookie(res);
    return res.json({ success: true });
  } catch (error) { return next(error); }
});

// PATCH /api/customer/auth/profile
router.patch("/profile", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const customer = await findSession(req);
    if (!customer) return res.status(401).json({ error: "Please sign in again." });
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Enter a valid full name." });
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
    await pool.execute(
      "UPDATE customers SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [name, phone || null, customer.id]
    );
    return res.json({ success: true, customer: { ...safeCustomer(customer), name, phone } });
  } catch (error) { return next(error); }
});

export default router;
