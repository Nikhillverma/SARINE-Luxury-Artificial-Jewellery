import { Router } from "express";
import { pool } from "./db.js";
import { ensureMarketingSchema, normalizeCouponCode, calculateCouponDiscount } from "./marketingPolicy.js";

const router = Router();

router.post("/validate", async (req, res, next) => {
  try {
    await ensureMarketingSchema();
    const code = normalizeCouponCode(req.body?.code);
    const subtotal = Number(req.body?.subtotal);
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!code || !Number.isSafeInteger(subtotal) || subtotal < 0) {
      return res.status(400).json({ error: "Enter a coupon code and valid basket subtotal." });
    }
    const [rows] = await pool.execute("SELECT * FROM marketing_coupons WHERE code = ? LIMIT 1", [code]);
    const coupon = rows[0];
    const now = new Date();
    if (!coupon || coupon.status !== "active") return res.status(400).json({ error: "This coupon is invalid or currently unavailable." });
    if (coupon.starts_at && new Date(coupon.starts_at) > now) return res.status(400).json({ error: "This coupon is not active yet." });
    if (new Date(coupon.expires_at) < now) return res.status(400).json({ error: "This coupon has expired." });
    if (coupon.usage_limit !== null && Number(coupon.used_count) >= Number(coupon.usage_limit)) return res.status(400).json({ error: "This coupon has reached its redemption limit." });
    if (subtotal < Number(coupon.min_order)) return res.status(400).json({ error: `Minimum order value for this coupon is ₹${Number(coupon.min_order).toLocaleString("en-IN")}.` });
    if (email) {
      const [uses] = await pool.execute("SELECT COUNT(*) AS total FROM marketing_coupon_redemptions WHERE coupon_id = ? AND customer_email = ? AND status IN ('reserved','redeemed')", [coupon.id, email]);
      if (Number(uses[0]?.total || 0) >= Number(coupon.per_customer_limit)) return res.status(400).json({ error: "This coupon has already been used the maximum number of times for this email address." });
    }
    const discountAmount = calculateCouponDiscount(coupon, subtotal);
    res.set("Cache-Control", "no-store");
    res.json({ valid: true, code, discountAmount, discountLabel: coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off` });
  } catch (error) { next(error); }
});

export default router;
