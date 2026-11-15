import { randomUUID } from "node:crypto";
let poolPromise;
async function getPool() {
  if (!poolPromise) poolPromise = import("./db.js").then((module) => module.pool);
  return poolPromise;
}

let schemaPromise;
export async function ensureMarketingSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const pool = await getPool();
      await pool.execute(`CREATE TABLE IF NOT EXISTS marketing_coupons (
        id CHAR(36) NOT NULL PRIMARY KEY,
        code VARCHAR(40) NOT NULL,
        discount_type ENUM('percentage','fixed') NOT NULL,
        discount_value INT NOT NULL,
        min_order INT NOT NULL DEFAULT 0,
        max_discount INT NULL,
        usage_limit INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        per_customer_limit INT NOT NULL DEFAULT 1,
        starts_at DATETIME(3) NULL,
        expires_at DATETIME(3) NOT NULL,
        status ENUM('active','paused') NOT NULL DEFAULT 'active',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_marketing_coupon_code (code),
        KEY idx_marketing_coupon_status_expiry (status, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.execute(`CREATE TABLE IF NOT EXISTS marketing_coupon_redemptions (
        id CHAR(36) NOT NULL PRIMARY KEY,
        coupon_id CHAR(36) NOT NULL,
        order_number VARCHAR(32) NOT NULL,
        customer_email VARCHAR(254) NOT NULL,
        discount_amount INT NOT NULL,
        status ENUM('reserved','redeemed','released') NOT NULL DEFAULT 'reserved',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_marketing_redemption_order (order_number),
        KEY idx_marketing_redemption_customer (coupon_id, customer_email, status),
        CONSTRAINT fk_marketing_redemption_coupon FOREIGN KEY (coupon_id) REFERENCES marketing_coupons(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      const [couponColumn] = await pool.execute("SHOW COLUMNS FROM orders LIKE 'coupon_code'");
      if (!couponColumn.length) await pool.execute("ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(40) NULL");
      const [discountColumn] = await pool.execute("SHOW COLUMNS FROM orders LIKE 'discount_amount'");
      if (!discountColumn.length) await pool.execute("ALTER TABLE orders ADD COLUMN discount_amount INT NOT NULL DEFAULT 0");
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

export function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function validateCouponPayload(input = {}) {
  const code = normalizeCouponCode(input.code);
  const discountType = input.discountType;
  const discountValue = Number(input.discountValue);
  const minOrder = Number(input.minOrder ?? 0);
  const maxDiscount = input.maxDiscount === "" || input.maxDiscount === null || input.maxDiscount === undefined
    ? null : Number(input.maxDiscount);
  const usageLimit = input.usageLimit === "" || input.usageLimit === null || input.usageLimit === undefined
    ? null : Number(input.usageLimit);
  const perCustomerLimit = Number(input.perCustomerLimit ?? 1);
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const expiresAt = new Date(input.expiresAt);

  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) throw new Error("Coupon code must be 3–40 characters using letters, numbers, _ or -.");
  if (!["percentage", "fixed"].includes(discountType)) throw new Error("Choose a percentage or fixed discount.");
  if (!Number.isInteger(discountValue) || discountValue < 1 || (discountType === "percentage" && discountValue > 100)) {
    throw new Error(discountType === "percentage" ? "Percentage discount must be between 1 and 100." : "Fixed discount must be a positive whole amount.");
  }
  if (!Number.isInteger(minOrder) || minOrder < 0 || minOrder > 1000000) throw new Error("Minimum order must be between ₹0 and ₹10,00,000.");
  if (maxDiscount !== null && (!Number.isInteger(maxDiscount) || maxDiscount < 1 || maxDiscount > 1000000)) throw new Error("Maximum discount must be a positive whole amount.");
  if (discountType === "fixed" && maxDiscount !== null) throw new Error("Maximum discount cap is only used for percentage coupons.");
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 1000000)) throw new Error("Usage limit must be a positive whole number.");
  if (!Number.isInteger(perCustomerLimit) || perCustomerLimit < 1 || perCustomerLimit > 1000) throw new Error("Per-customer limit must be between 1 and 1,000.");
  if (startsAt && !Number.isFinite(startsAt.getTime())) throw new Error("Enter a valid start date.");
  if (!Number.isFinite(expiresAt.getTime())) throw new Error("Enter a valid expiry date.");
  if (startsAt && startsAt >= expiresAt) throw new Error("Expiry must be later than the start date.");

  return {
    code, discountType, discountValue, minOrder, maxDiscount, usageLimit, perCustomerLimit,
    startsAt: startsAt ? startsAt.toISOString().slice(0, 19).replace("T", " ") : null,
    expiresAt: expiresAt.toISOString().slice(0, 19).replace("T", " "),
    status: input.status === "paused" ? "paused" : "active"
  };
}

export function calculateCouponDiscount(coupon, subtotal) {
  const amount = Number(subtotal);
  if (!Number.isSafeInteger(amount) || amount < Number(coupon.min_order)) throw new Error(`Minimum order value for this coupon is ₹${Number(coupon.min_order).toLocaleString("en-IN")}.`);
  const raw = coupon.discount_type === "percentage"
    ? Math.floor(amount * Number(coupon.discount_value) / 100)
    : Number(coupon.discount_value);
  const capped = coupon.max_discount === null || coupon.max_discount === undefined
    ? raw : Math.min(raw, Number(coupon.max_discount));
  return Math.max(0, Math.min(amount, Math.floor(capped)));
}

export async function lockAndValidateCoupon(connection, codeInput, subtotal, email) {
  const code = normalizeCouponCode(codeInput);
  if (!code) return { coupon: null, discountAmount: 0 };
  await ensureMarketingSchema();
  const [rows] = await connection.execute("SELECT * FROM marketing_coupons WHERE code = ? FOR UPDATE", [code]);
  const coupon = rows[0];
  if (!coupon || coupon.status !== "active") throw new Error("This coupon is invalid or currently unavailable.");
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) throw new Error("This coupon is not active yet.");
  if (new Date(coupon.expires_at) < now) throw new Error("This coupon has expired.");
  if (coupon.usage_limit !== null && Number(coupon.used_count) >= Number(coupon.usage_limit)) throw new Error("This coupon has reached its redemption limit.");
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (normalizedEmail) {
    const [uses] = await connection.execute(
      "SELECT COUNT(*) AS total FROM marketing_coupon_redemptions WHERE coupon_id = ? AND customer_email = ? AND status IN ('reserved','redeemed')",
      [coupon.id, normalizedEmail]
    );
    if (Number(uses[0]?.total || 0) >= Number(coupon.per_customer_limit)) throw new Error("This coupon has already been used the maximum number of times for this email address.");
  }
  const discountAmount = calculateCouponDiscount(coupon, subtotal);
  return { coupon, discountAmount };
}

export async function reserveCouponRedemption(connection, coupon, orderNumber, email, discountAmount, status = "reserved") {
  if (!coupon) return;
  await connection.execute(
    "UPDATE marketing_coupons SET used_count = used_count + 1 WHERE id = ?",
    [coupon.id]
  );
  await connection.execute(
    "INSERT INTO marketing_coupon_redemptions (id, coupon_id, order_number, customer_email, discount_amount, status) VALUES (?, ?, ?, ?, ?, ?)",
    [randomUUID(), coupon.id, orderNumber, String(email || "").trim().toLowerCase(), discountAmount, status]
  );
}

export async function releaseCouponReservation(orderNumber) {
  await ensureMarketingSchema();
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT coupon_id, status FROM marketing_coupon_redemptions WHERE order_number = ? FOR UPDATE",
      [orderNumber]
    );
    if (rows[0]?.status === "reserved") {
      await connection.execute("UPDATE marketing_coupon_redemptions SET status = 'released' WHERE order_number = ?", [orderNumber]);
      await connection.execute("UPDATE marketing_coupons SET used_count = GREATEST(0, used_count - 1) WHERE id = ?", [rows[0].coupon_id]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function confirmCouponRedemption(connection, orderNumber) {
  await connection.execute(
    "UPDATE marketing_coupon_redemptions SET status = 'redeemed' WHERE order_number = ? AND status = 'reserved'",
    [orderNumber]
  );
}
