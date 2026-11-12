import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

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
       image_url=?, is_active=?, sort_order=? WHERE id=?`,
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
    const trustMessages = Array.isArray(req.body?.trustMessages)
      ? req.body.trustMessages.slice(0, 3).map(item => String(item || "").trim())
      : [];
    if (message.length > 300) return res.status(400).json({ error: "Announcement must be 300 characters or fewer." });
    if (trustMessages.some(item => item.length > 100)) return res.status(400).json({ error: "Each trust message must be 100 characters or fewer." });
    await pool.execute(
      "INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('announcement', ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
      [JSON.stringify({ message, active, trustMessages })]
    );
    res.json({ success: true, announcement: { message, active, trustMessages } });
  } catch (error) { next(error); }
});
adminOnly.get("/announcement", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    let announcement = { message: "", active: false, trustMessages: ["Free Shipping Above ₹1,999", "7-Day Easy Returns", "Trusted by 1L+ Happy Customers"] };
    if (rows.length) {
      try {
        const saved = JSON.parse(rows[0].setting_value);
        announcement = {
          message: typeof saved.message === "string" ? saved.message : "",
          active: saved.active === true,
          trustMessages: Array.isArray(saved.trustMessages) && saved.trustMessages.length
            ? saved.trustMessages.slice(0, 3).map(item => String(item || "").trim().slice(0, 100))
            : ["Free Shipping Above ₹1,999", "7-Day Easy Returns", "Trusted by 1L+ Happy Customers"]
        };
      } catch {}
    }
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
    let announcement = { message: "", active: false, trustMessages: [] };
    if (rows.length) {
      try {
        const saved = JSON.parse(rows[0].setting_value);
        announcement = {
          message: typeof saved.message === "string" ? saved.message : "",
          active: saved.active === true,
          trustMessages: Array.isArray(saved.trustMessages)
            ? saved.trustMessages.slice(0, 3).map(item => String(item || "").trim().slice(0, 100))
            : []
        };
      } catch {}
    }
    res.set("Cache-Control", "no-store").json({ announcement });
  } catch (error) { next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicStorefrontRouter };
export default admin;
