import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { shouldUseSecureSessionCookie } from "./sessionCookiePolicy.js";
import { normalizeCustomerEmail } from "./customerValidation.js";
import { normalizePhone } from "./customerOtpPolicy.js";
import { canCancelOrder, shouldRestoreStockOnCancellation } from "./orderAdminPolicy.js";
import { ensureInventoryTable, recordInventoryMovement } from "./inventoryLedger.js";
import { ensureProductVariantSchema, syncProductVariantStock, recordVariantInventoryMovement } from "./productVariantSchema.js";
import { formatVariantLabel } from "./productVariantPolicy.js";
import { sortStockItems } from "./stockLockPolicy.js";
import { ensureMarketingSchema, releaseCouponRedemptionForCancelledOrder } from "./marketingPolicy.js";

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
    secure: shouldUseSecureSessionCookie(),
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });
}
function clearCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "lax",
    path: "/api"
  });
}
function safeCustomer(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone || "" };
}
export async function getAuthenticatedCustomer(req) {
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
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ error: "Please sign in again." });
    const [rows] = await pool.execute(
      `SELECT id, order_number, customer_name, customer_email, customer_phone,
              shipping_address, subtotal, shipping_fee, total, payment_method,
              payment_status, order_status, courier_name, tracking_number,
              tracking_url, shipped_at, delivered_at, cancelled_at,
              cancellation_reason, refund_needed, refund_amount, return_status,
              return_reason, return_notes, created_at
       FROM orders WHERE customer_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 100`,
      [customer.id]
    );
    await ensureProductVariantSchema();
    const ids = rows.map((row) => row.id);
    const itemsByOrder = {};
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [items] = await pool.query(
        `SELECT order_id, product_id, product_name, sku, unit_price, quantity, image,
                variant_id, variant_sku, variant_label, variant_options
         FROM order_items WHERE order_id IN (${placeholders}) ORDER BY source_line ASC, id ASC`,
        ids
      );
      for (const item of items) {
        (itemsByOrder[item.order_id] ||= []).push({
          productId: item.product_id || "",
          name: item.product_name || "Product",
          image: item.image || "",
          sku: item.variant_sku || item.sku || undefined,
          variantId: item.variant_id || undefined,
          variantLabel: item.variant_label || undefined,
          variantOptions: typeof item.variant_options === "string" ? JSON.parse(item.variant_options) : (item.variant_options || undefined),
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
        refundAmount: Number(row.refund_amount) || 0,
        returnStatus: row.return_status || 'none',
        returnReason: row.return_reason || undefined,
        returnNotes: row.return_notes || undefined
      };
    }) });
  } catch (error) { return next(error); }
});

// POST /api/customer/auth/cancel — cancel an eligible order owned by this account.
router.post("/cancel", async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ error: "Please sign in to cancel an order." });
    const orderNumber = String(req.body?.orderNumber || "").trim().toUpperCase();
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "Cancelled by customer";
    if (!/^SAR-\d{6}$/.test(orderNumber)) return res.status(400).json({ error: "Enter a valid order number." });
    if (reason.length > 500) return res.status(400).json({ error: "Cancellation reason must be 500 characters or fewer." });

    await ensureInventoryTable();
    await ensureProductVariantSchema();
    await ensureMarketingSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT * FROM orders WHERE order_number = ? AND customer_id = ? FOR UPDATE",
      [orderNumber, customer.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "We couldn't find this order in your account." });
    }
    const order = rows[0];
    if (["shipped", "delivered"].includes(order.order_status)) {
      await connection.rollback();
      return res.status(400).json({ error: "Orders that have shipped or been delivered cannot be cancelled online. Please contact SARINE support." });
    }
    if (order.order_status === "cancelled") {
      await connection.rollback();
      return res.status(400).json({ error: "This order is already cancelled." });
    }
    if (!canCancelOrder(order)) {
      await connection.rollback();
      return res.status(400).json({ error: "This order cannot be cancelled in its current status." });
    }

    const isPaid = order.payment_status === "paid";
    const stockWasDecremented = shouldRestoreStockOnCancellation(order);

    // Release reserved or redeemed coupon capacity in the same transaction
    // as cancellation, matching the admin cancellation path.
    if (order.coupon_code) {
      await releaseCouponRedemptionForCancelledOrder(connection, order.order_number);
    }
    if (stockWasDecremented) {
      const [lines] = await connection.execute(
        `SELECT product_id, variant_id, SUM(quantity) AS quantity
         FROM order_items
         WHERE order_id = ? AND product_id IS NOT NULL
         GROUP BY product_id, variant_id`,
        [order.id]
      );
      const stockItems = sortStockItems(lines.map(line => ({
        ...line,
        productId: line.product_id,
        variantId: line.variant_id || null
      })));

      for (const line of stockItems) {
        const quantity = Number(line.quantity);
        if (!Number.isSafeInteger(quantity) || quantity <= 0) {
          throw new Error("Cannot restore inventory: an order line has an invalid quantity.");
        }

        // All checkout, payment settlement, and admin cancellation paths lock
        // the parent product before any variant, in the same deterministic order.
        const [products] = await connection.execute(
          "SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE",
          [line.product_id]
        );
        if (!products.length) {
          throw new Error(`Cannot restore inventory: product ${line.product_id} for order ${orderNumber} no longer exists.`);
        }
        const product = products[0];

        if (line.variant_id) {
          const [variants] = await connection.execute(
            `SELECT id, product_id, sku, option1_name, option1_value, option2_name, option2_value, stock
             FROM product_variants
             WHERE id = ? AND product_id = ? FOR UPDATE`,
            [line.variant_id, line.product_id]
          );
          if (!variants.length) {
            throw new Error(`Cannot restore inventory: variant ${line.variant_id} for order ${orderNumber} no longer exists.`);
          }
          const variant = variants[0];
          const previousStock = Number(variant.stock || 0);
          const newStock = previousStock + quantity;
          if (!Number.isSafeInteger(newStock) || newStock > 2147483647) {
            throw new Error("Variant stock restoration would exceed the supported inventory balance.");
          }
          await connection.execute(
            "UPDATE product_variants SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
            [newStock, line.variant_id]
          );
          await syncProductVariantStock(connection, line.product_id);
          await recordVariantInventoryMovement(connection, {
            variantId: line.variant_id, productId: line.product_id,
            productName: product.name, variantSku: variant.sku,
            variantLabel: formatVariantLabel(variant.option1_name, variant.option1_value, variant.option2_name, variant.option2_value),
            previousStock, quantityDelta: quantity, newStock,
            reason: `Customer cancellation restock ${orderNumber}`,
            adminId: customer.id, adminName: customer.name, adminEmail: customer.email
          });
          continue;
        }

        const previousStock = Number(product.stock || 0);
        const newStock = previousStock + quantity;
        if (!Number.isSafeInteger(newStock) || newStock > 2147483647) {
          throw new Error("Stock restoration would exceed the supported inventory balance.");
        }
        await connection.execute(
          "UPDATE products SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
          [newStock, line.product_id]
        );
        await recordInventoryMovement(connection, {
          productId: product.id, productName: product.name, previousStock,
          quantityDelta: quantity, newStock,
          reason: `Customer cancellation restock ${orderNumber}`,
          actorId: customer.id, actorName: customer.name, actorEmail: customer.email
        });
      }
    }

    const updateFields = [
      "order_status = 'cancelled'",
      "cancelled_at = UTC_TIMESTAMP(3)",
      "cancellation_reason = ?",
      "updated_at = UTC_TIMESTAMP(3)"
    ];
    const updateValues = [reason || "Cancelled by customer"];
    if (isPaid) {
      updateFields.push("refund_needed = 1", "refund_amount = ?");
      updateValues.push(Number(order.total) || 0);
    }
    updateValues.push(order.id);
    await connection.execute(
      `UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );
    await connection.execute(
      "INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at) VALUES (?, ?, 'cancelled', ?, ?, UTC_TIMESTAMP(3))",
      [order.id, order.order_status, reason || "Cancelled by customer", customer.email]
    );
    await connection.commit();
    return res.json({
      success: true,
      orderNumber,
      orderStatus: "cancelled",
      refundNeeded: isPaid,
      stockRestored: stockWasDecremented,
      message: isPaid
        ? "Your order has been cancelled. The payment has not been refunded automatically; SARINE support will review the refund."
        : "Your order has been cancelled successfully."
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection?.release();
  }
});

// POST /api/customer/auth/returns — return/exchange requests for orders owned by this account.
router.post("/returns", async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ error: "Please sign in to request a return or exchange." });

    const orderNumber = String(req.body?.orderNumber || "").trim().toUpperCase();
    const requestType = String(req.body?.requestType || "").trim().toLowerCase();
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    if (!/^SAR-\d{6}$/.test(orderNumber)) return res.status(400).json({ error: "Enter a valid order number." });
    if (!["return", "exchange"].includes(requestType)) return res.status(400).json({ error: "Choose return or exchange." });
    if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: "Please provide a reason between 3 and 500 characters." });
    if (notes.length > 2000) return res.status(400).json({ error: "Additional notes must be 2,000 characters or fewer." });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [orders] = await connection.execute(
      "SELECT id, order_status, delivered_at FROM orders WHERE order_number = ? AND customer_id = ? FOR UPDATE",
      [orderNumber, customer.id]
    );
    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({ error: "We couldn't find this order in your account." });
    }
    const order = orders[0];
    if (order.order_status !== "delivered" || !order.delivered_at) {
      await connection.rollback();
      return res.status(400).json({ error: "Return or exchange requests can only be submitted after delivery." });
    }
    const [windowRows] = await connection.execute(
      "SELECT (UTC_TIMESTAMP(3) <= DATE_ADD(?, INTERVAL 7 DAY)) AS within_window",
      [order.delivered_at]
    );
    if (!Number(windowRows[0]?.within_window)) {
      await connection.rollback();
      return res.status(400).json({ error: "The 7-day return request window has ended for this order." });
    }
    const [existing] = await connection.execute(
      "SELECT id FROM returns WHERE order_id = ? AND status NOT IN ('rejected', 'closed') LIMIT 1 FOR UPDATE",
      [order.id]
    );
    if (existing.length) {
      await connection.rollback();
      return res.status(409).json({ error: "A return or exchange request is already open for this order." });
    }
    const [insertResult] = await connection.execute(
      "INSERT INTO returns (order_id, request_type, reason, notes, status, created_at) VALUES (?, ?, ?, ?, 'pending', UTC_TIMESTAMP(3))",
      [order.id, requestType, reason, notes || null]
    );
    await connection.commit();
    return res.status(201).json({
      success: true,
      requestId: Number(insertResult.insertId),
      orderNumber,
      status: "pending",
      message: `Your ${requestType} request has been submitted. Our team will review it.`
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection?.release();
  }
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
    const customer = await getAuthenticatedCustomer(req);
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
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ error: "Please sign in again." });
    const name = String(req.body?.name || "").trim();
    if (name.length < 2 || name.length > 120) return res.status(400).json({ error: "Enter a valid full name." });
    if (req.body?.phone !== undefined && normalizePhone(req.body.phone) !== normalizePhone(customer.phone)) {
      return res.status(409).json({ error: "Mobile numbers must be verified before they can be changed. Use the verified contact-linking flow in your SARINE account." });
    }
    await pool.execute(
      "UPDATE customers SET name = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [name, customer.id]
    );
    return res.json({ success: true, customer: { ...safeCustomer(customer), name } });
  } catch (error) { return next(error); }
});

export default router;
