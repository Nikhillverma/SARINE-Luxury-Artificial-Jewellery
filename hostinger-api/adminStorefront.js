import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import rateLimit from "express-rate-limit";
import { validateImageUpload } from "./mediaValidation.js";

const admin = Router();
const publicRouter = Router();
const adminOnly = Router();
adminOnly.use(requireAdminAuth);

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.execute(`CREATE TABLE IF NOT EXISTS storefront_banners (
        id CHAR(36) NOT NULL PRIMARY KEY,
        tagline VARCHAR(120) NOT NULL DEFAULT '',
        title VARCHAR(180) NOT NULL,
        subtitle VARCHAR(500) NOT NULL DEFAULT '',
        cta_text VARCHAR(80) NOT NULL DEFAULT 'Shop now',
        cta_link VARCHAR(500) NOT NULL DEFAULT '/shop',
        image_url VARCHAR(2048) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_storefront_banners_active_order (is_active, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch(error => { schemaReady = undefined; throw error; });
  }
  await schemaReady;
}

function mapBanner(row) {
  return {
    id: row.id, tagline: row.tagline, title: row.title, subtitle: row.subtitle,
    ctaText: row.cta_text, ctaLink: row.cta_link, imageUrl: row.image_url,
    active: Boolean(row.is_active), sortOrder: Number(row.sort_order)
  };
}
function validate(input) {
  const title = String(input.title || "").trim();
  const imageUrl = String(input.imageUrl || "").trim();
  const ctaLink = String(input.ctaLink || "/shop").trim();
  if (!title || title.length > 180) return "Banner title is required (maximum 180 characters).";
  if (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 2048) return "Banner image must be a valid HTTPS media URL.";
  if (!(ctaLink.startsWith("/") && !ctaLink.startsWith("//")) && !/^https:\/\//i.test(ctaLink)) return "CTA destination must be a site path or HTTPS URL.";
  if (ctaLink.length > 500) return "CTA destination is too long.";
  return null;
}

adminOnly.get("/banners", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT * FROM storefront_banners ORDER BY sort_order ASC, created_at ASC");
    res.set("Cache-Control", "no-store").json({ banners: rows.map(mapBanner) });
  } catch (error) { next(error); }
});
adminOnly.post("/banners", async (req, res, next) => {
  try {
    await ensureSchema();
    const input = req.body || {};
    const invalid = validate(input);
    if (invalid) return res.status(400).json({ error: invalid });
    const id = crypto.randomUUID();
    const [count] = await pool.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM storefront_banners");
    await pool.execute(
      `INSERT INTO storefront_banners
       (id, tagline, title, subtitle, cta_text, cta_link, image_url, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(input.tagline || "").slice(0,120), String(input.title).trim(),
       String(input.subtitle || "").slice(0,500), String(input.ctaText || "Shop now").slice(0,80),
       String(input.ctaLink || "/shop").trim(), String(input.imageUrl).trim(),
       input.active === true ? 1 : 0, Number.isInteger(input.sortOrder) ? input.sortOrder : Number(count[0].next_order)]
    );
    const [rows] = await pool.execute("SELECT * FROM storefront_banners WHERE id = ?", [id]);
    res.status(201).json({ banner: mapBanner(rows[0]) });
  } catch (error) { next(error); }
});
adminOnly.put("/banners/:id", async (req, res, next) => {
  try {
    await ensureSchema();
    const input = req.body || {};
    const [existing] = await pool.execute("SELECT * FROM storefront_banners WHERE id = ? LIMIT 1", [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: "Banner not found." });
    const current = mapBanner(existing[0]);
    const merged = { ...current, ...input };
    const invalid = validate(merged);
    if (invalid) return res.status(400).json({ error: invalid });
    await pool.execute(
      `UPDATE storefront_banners SET tagline=?, title=?, subtitle=?, cta_text=?, cta_link=?,
       image_url=?, is_active=?, sort_order=? WHERE id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
      [String(merged.tagline || "").slice(0,120), String(merged.title).trim(),
       String(merged.subtitle || "").slice(0,500), String(merged.ctaText || "Shop now").slice(0,80),
       String(merged.ctaLink || "/shop").trim(), String(merged.imageUrl).trim(),
       merged.active === true ? 1 : 0,
       Number.isInteger(merged.sortOrder) ? merged.sortOrder : current.sortOrder, req.params.id]
    );
    const [rows] = await pool.execute("SELECT * FROM storefront_banners WHERE id = ?", [req.params.id]);
    res.json({ banner: mapBanner(rows[0]) });
  } catch (error) { next(error); }
});
adminOnly.delete("/banners/:id", async (req, res, next) => {
  try {
    await ensureSchema();
    const [result] = await pool.execute("DELETE FROM storefront_banners WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Banner not found." });
    res.json({ success: true });
  } catch (error) { next(error); }
});
adminOnly.put("/banners/reorder", async (req, res, next) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length > 30 || ids.some(id => typeof id !== "string")) return res.status(400).json({ error: "Provide a valid ordered list of banner IDs." });
  let connection;
  try {
    await ensureSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (let i = 0; i < ids.length; i++) await connection.execute("UPDATE storefront_banners SET sort_order=? WHERE id=?", [i, ids[i]]);
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
});
adminOnly.put("/announcement", async (req, res, next) => {
  try {
    await ensureSchema();
    const message = String(req.body?.message || "").trim();
    const active = req.body?.active === true;
    if (message.length > 300) return res.status(400).json({ error: "Announcement must be 300 characters or fewer." });
    await pool.execute(
      "INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('announcement', ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
      [JSON.stringify({ message, active })]
    );
    res.json({ success: true, announcement: { message, active } });
  } catch (error) { next(error); }
});
adminOnly.get("/announcement", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    let announcement = { message: "", active: false };
    if (rows.length) { try { announcement = JSON.parse(rows[0].setting_value); } catch {} }
    res.set("Cache-Control", "no-store").json({ announcement });
  } catch (error) { next(error); }
});

publicRouter.get("/banners", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT * FROM storefront_banners WHERE is_active=1 ORDER BY sort_order ASC, created_at ASC");
    res.set("Cache-Control", "no-store").json({ banners: rows.map(mapBanner) });
  } catch (error) { next(error); }
});
publicRouter.get("/announcement", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    let announcement = { message: "", active: false };
    if (rows.length) { try { announcement = JSON.parse(rows[0].setting_value); } catch {} }
    res.set("Cache-Control", "no-store").json({ announcement });
  } catch (error) { next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicStorefrontRouter };
export default admin;


// Editorial Collection content is stored independently from hero banner records.
const editorialDefaults = {
  eyebrow: "EDITORIAL COLLECTION",
  title: "The Art of Everyday Elegance",
  description: "A curated collection that blends classic beauty with modern sensibilities.",
  ctaText: "Explore the Collection",
  ctaLink: "/shop",
  imageUrl: "/images/editorial-banner.jpg",
  active: true
};
async function readEditorial() {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='editorial_collection' LIMIT 1");
  if (!rows.length) return editorialDefaults;
  try { return { ...editorialDefaults, ...JSON.parse(rows[0].setting_value) }; }
  catch { return editorialDefaults; }
}
adminOnly.get("/editorial", async (_req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ editorial: await readEditorial() }); }
  catch (error) { next(error); }
});
adminOnly.put("/editorial", async (req, res, next) => {
  try {
    const input = req.body || {};
    const editorial = {
      eyebrow: String(input.eyebrow ?? "").trim(),
      title: String(input.title ?? "").trim(),
      description: String(input.description ?? "").trim(),
      ctaText: String(input.ctaText ?? "").trim(),
      ctaLink: String(input.ctaLink ?? "").trim(),
      imageUrl: String(input.imageUrl ?? "").trim(),
      active: input.active === true
    };
    if (!editorial.title || editorial.title.length > 180) return res.status(400).json({ error: "Heading is required (maximum 180 characters)." });
    if (editorial.eyebrow.length > 120 || editorial.description.length > 500 || editorial.ctaText.length > 80) return res.status(400).json({ error: "Editorial text exceeds the allowed length." });
    if (!editorial.imageUrl || editorial.imageUrl.length > 2048 || (!editorial.imageUrl.startsWith("/") && !/^https:\/\//i.test(editorial.imageUrl))) return res.status(400).json({ error: "Choose a valid uploaded image." });
    if (!(editorial.ctaLink.startsWith("/") && !editorial.ctaLink.startsWith("//")) && !/^https:\/\//i.test(editorial.ctaLink)) return res.status(400).json({ error: "Button destination must be a site path or HTTPS URL." });
    if (editorial.ctaLink.length > 500) return res.status(400).json({ error: "Button destination is too long." });
    await pool.execute("INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('editorial_collection', ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [JSON.stringify(editorial)]);
    res.json({ editorial });
  } catch (error) { next(error); }
});
publicRouter.get("/editorial", async (_req, res, next) => {
  try {
    const editorial = await readEditorial();
    res.set("Cache-Control", "no-store").json({ editorial: editorial.active ? editorial : null });
  } catch (error) { next(error); }
});

// Customer reviews are private until an administrator approves them.
// A guest proves purchase by supplying the order number and the email used at checkout.
async function ensureReviewSchema() {
  await ensureSchema();
  await pool.execute(`CREATE TABLE IF NOT EXISTS product_reviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    product_id VARCHAR(191) NOT NULL,
    order_id VARCHAR(191) NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(254) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL DEFAULT '',
    comment TEXT NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    admin_reply VARCHAR(1000) NULL,
    image_urls TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_review_order_product (order_id, product_id),
    INDEX idx_reviews_product_status (product_id, status, created_at),
    INDEX idx_reviews_status_date (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [columns] = await pool.execute("SHOW COLUMNS FROM product_reviews LIKE 'image_urls'");
  if (!columns.length) await pool.execute("ALTER TABLE product_reviews ADD COLUMN image_urls TEXT NULL");
}
async function ensureReviewMediaTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS media_assets (
    id CHAR(36) NOT NULL PRIMARY KEY, file_name VARCHAR(255) NOT NULL, mime_type VARCHAR(32) NOT NULL,
    file_size INT UNSIGNED NOT NULL, image_data MEDIUMBLOB NOT NULL, uploaded_by VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_media_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
const reviewImageUploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many photo uploads. Please try again later." } });
publicRouter.post("/review-images", reviewImageUploadLimit, async (req, res, next) => {
  try {
    const { buffer, fileName, mimeType } = validateImageUpload(req.body || {});
    await ensureReviewMediaTable();
    const id = crypto.randomUUID();
    await pool.execute("INSERT INTO media_assets (id, file_name, mime_type, file_size, image_data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)", [id, fileName, mimeType, buffer.length, buffer, "customer-review"]);
    res.status(201).json({ success: true, media: { id, url: "/api/media/" + id } });
  } catch (error) {
    if (error.message?.includes("image") || error.message?.includes("filename") || error.message?.includes("JPEG") || error.message?.includes("2 MB")) return res.status(400).json({ error: error.message });
    next(error);
  }
});
function mapReview(row) {
  let imageUrls = [];
  try { imageUrls = row.image_urls ? JSON.parse(row.image_urls) : []; } catch {}
  return {
    id: row.id, productId: row.product_id, name: row.customer_name,
    rating: Number(row.rating), title: row.title, comment: row.comment,
    status: row.status, verified: true, adminReply: row.admin_reply || "",
    imageUrls, date: row.created_at
  };
}
publicRouter.get("/products/:productId/reviews", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const productId = String(req.params.productId || "");
    const [rows] = await pool.execute("SELECT id, product_id, customer_name, rating, title, comment, status, admin_reply, created_at FROM product_reviews WHERE product_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND status='approved' ORDER BY created_at DESC LIMIT 100", [productId]);
    const [summary] = await pool.execute("SELECT COUNT(*) AS count, COALESCE(AVG(rating),0) AS average FROM product_reviews WHERE product_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND status='approved'", [productId]);
    res.set("Cache-Control", "no-store").json({ reviews: rows.map(mapReview), count: Number(summary[0].count), average: Number(summary[0].average) });
  } catch (error) { next(error); }
});
publicRouter.post("/products/:productId/reviews", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const productId = String(req.params.productId || "").trim();
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const orderNumber = String(req.body?.orderNumber || "").trim();
    const rating = Number(req.body?.rating);
    const title = String(req.body?.title || "").trim();
    const comment = String(req.body?.comment || "").trim();
    if (!productId || !name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !orderNumber || orderNumber.length > 64 || !Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length < 10 || comment.length > 3000 || title.length > 160) {
      return res.status(400).json({ error: "Enter your name, valid checkout email, order number, 1–5 star rating and feedback (10–3000 characters)." });
    }
    const [orders] = await pool.execute("SELECT id FROM orders WHERE order_number COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND LOWER(customer_email) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND order_status='delivered' LIMIT 1", [orderNumber, email]);
    if (!orders.length) return res.status(400).json({ error: "We could not match that order number and checkout email. Please check both details." });
    const [items] = await pool.execute("SELECT product_id FROM order_items WHERE order_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND product_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci LIMIT 1", [orders[0].id, productId]);
    if (!items.length) return res.status(403).json({ error: "That product is not included in the supplied order." });
    const id = crypto.randomUUID();
    try {
      await pool.execute("INSERT INTO product_reviews (id, product_id, order_id, customer_name, customer_email, rating, title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [id, productId, orders[0].id, name, email, rating, title, comment]);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A review has already been submitted for this product and order." });
      throw error;
    }
    res.status(201).json({ success: true, message: "Thank you. Your review has been submitted for moderation." });
  } catch (error) { next(error); }
});
adminOnly.get("/reviews", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const status = ["pending","approved","rejected","all"].includes(String(req.query.status)) ? String(req.query.status) : "pending";
    const where = status === "all" ? "" : "WHERE r.status=?";
    const params = status === "all" ? [] : [status];
    const [rows] = await pool.execute(`SELECT r.id, r.product_id, r.order_id, r.customer_name, r.customer_email, r.rating, r.title, r.comment, r.status, r.admin_reply, r.created_at, p.name AS product_name, o.order_number FROM product_reviews r LEFT JOIN products p ON p.id COLLATE utf8mb4_unicode_ci = r.product_id COLLATE utf8mb4_unicode_ci LEFT JOIN orders o ON o.id COLLATE utf8mb4_unicode_ci = r.order_id COLLATE utf8mb4_unicode_ci ${where} ORDER BY r.created_at DESC LIMIT 300`, params);
    res.set("Cache-Control", "no-store").json({ reviews: rows.map(row => ({ ...mapReview(row), email: row.customer_email, orderNumber: row.order_number, productName: row.product_name })) });
  } catch (error) { next(error); }
});
adminOnly.patch("/reviews/:id", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const status = String(req.body?.status || "");
    const reply = String(req.body?.adminReply || "").trim();
    if (!["approved","rejected","pending"].includes(status) || reply.length > 1000) return res.status(400).json({ error: "Choose a valid moderation status and reply (maximum 1000 characters)." });
    const [result] = await pool.execute("UPDATE product_reviews SET status=?, admin_reply=? WHERE id=?", [status, reply || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Review not found." });
    res.json({ success: true });
  } catch (error) { next(error); }
});
