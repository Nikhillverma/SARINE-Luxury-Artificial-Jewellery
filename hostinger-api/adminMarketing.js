import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAdminAuth } from "./adminAuth.js";
import { pool } from "./db.js";
import { ensureMarketingSchema, validateCouponPayload } from "./marketingPolicy.js";

const router = Router();
router.use(requireAdminAuth);

function mapCoupon(row) {
  const now = Date.now();
  const startsAt = row.starts_at ? new Date(row.starts_at) : null;
  const expiresAt = new Date(row.expires_at);
  const effectiveStatus = row.status !== "active" ? "paused"
    : startsAt && startsAt.getTime() > now ? "scheduled"
    : expiresAt.getTime() < now ? "expired" : "active";
  return {
    id: row.id, code: row.code, discountType: row.discount_type,
    discountValue: Number(row.discount_value), minOrder: Number(row.min_order),
    maxDiscount: row.max_discount === null ? null : Number(row.max_discount),
    usageLimit: row.usage_limit === null ? null : Number(row.usage_limit),
    usedCount: Number(row.used_count), perCustomerLimit: Number(row.per_customer_limit),
    startsAt: row.starts_at, expiresAt: row.expires_at, status: effectiveStatus,
    enabled: row.status === "active"
  };
}

router.get("/coupons", async (_req, res, next) => {
  try {
    await ensureMarketingSchema();
    const [rows] = await pool.execute("SELECT * FROM marketing_coupons ORDER BY created_at DESC");
    res.set("Cache-Control", "no-store");
    res.json({ coupons: rows.map(mapCoupon) });
  } catch (error) { next(error); }
});

router.post("/coupons", async (req, res, next) => {
  try {
    await ensureMarketingSchema();
    const input = validateCouponPayload(req.body);
    const id = randomUUID();
    await pool.execute(
      "INSERT INTO marketing_coupons (id, code, discount_type, discount_value, min_order, max_discount, usage_limit, per_customer_limit, starts_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, input.code, input.discountType, input.discountValue, input.minOrder, input.maxDiscount, input.usageLimit, input.perCustomerLimit, input.startsAt, input.expiresAt, input.status]
    );
    const [rows] = await pool.execute("SELECT * FROM marketing_coupons WHERE id = ?", [id]);
    res.status(201).json({ coupon: mapCoupon(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A coupon with this code already exists." });
    if (error.message && /coupon|discount|minimum|expiry|start|usage|customer|maximum/i.test(error.message)) return res.status(400).json({ error: error.message });
    next(error);
  }
});

router.put("/coupons/:id", async (req, res, next) => {
  try {
    await ensureMarketingSchema();
    const input = validateCouponPayload(req.body);
    const [existing] = await pool.execute("SELECT id FROM marketing_coupons WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: "Coupon not found." });
    await pool.execute(
      "UPDATE marketing_coupons SET code = ?, discount_type = ?, discount_value = ?, min_order = ?, max_discount = ?, usage_limit = ?, per_customer_limit = ?, starts_at = ?, expires_at = ?, status = ? WHERE id = ?",
      [input.code, input.discountType, input.discountValue, input.minOrder, input.maxDiscount, input.usageLimit, input.perCustomerLimit, input.startsAt, input.expiresAt, input.status, req.params.id]
    );
    const [rows] = await pool.execute("SELECT * FROM marketing_coupons WHERE id = ?", [req.params.id]);
    res.json({ coupon: mapCoupon(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A coupon with this code already exists." });
    if (error.message && /coupon|discount|minimum|expiry|start|usage|customer|maximum/i.test(error.message)) return res.status(400).json({ error: error.message });
    next(error);
  }
});

router.patch("/coupons/:id/status", async (req, res, next) => {
  try {
    await ensureMarketingSchema();
    const status = req.body?.status === "active" ? "active" : req.body?.status === "paused" ? "paused" : null;
    if (!status) return res.status(400).json({ error: "Choose active or paused status." });
    const [result] = await pool.execute("UPDATE marketing_coupons SET status = ? WHERE id = ?", [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Coupon not found." });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete("/coupons/:id", async (req, res, next) => {
  try {
    await ensureMarketingSchema();
    const [uses] = await pool.execute("SELECT COUNT(*) AS total FROM marketing_coupon_redemptions WHERE coupon_id = ?", [req.params.id]);
    if (Number(uses[0]?.total || 0) > 0) return res.status(409).json({ error: "This coupon has order history. Pause it instead of deleting it." });
    const [result] = await pool.execute("DELETE FROM marketing_coupons WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Coupon not found." });
    res.json({ success: true });
  } catch (error) { next(error); }
});

export default router;
