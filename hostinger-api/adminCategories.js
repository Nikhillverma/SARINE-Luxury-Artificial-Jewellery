import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

const slugify = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
const map = row => ({ id: row.id, slug: row.slug, name: row.name, description: row.description || "", image: row.image || "", isActive: Boolean(row.is_active), sortOrder: Number(row.sort_order) });

function validate(body, partial = false) {
  const errors = [];
  if (!partial || body.name !== undefined) if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) errors.push("Category name is required (maximum 120 characters).");
  if (body.description !== undefined && String(body.description).length > 1000) errors.push("Description must be 1,000 characters or fewer.");
  if (body.image !== undefined && body.image !== "" && (!/^https:\/\//i.test(body.image) || body.image.length > 2048)) errors.push("Category image must be a valid HTTPS URL.");
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") errors.push("isActive must be true or false.");
  if (body.sortOrder !== undefined && (!Number.isInteger(body.sortOrder) || body.sortOrder < 0)) errors.push("Sort order must be a non-negative integer.");
  return errors;
}

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM categories ORDER BY sort_order ASC, name ASC");
    res.set("Cache-Control", "no-store").json({ categories: rows.map(map) });
  } catch (e) { next(e); }
});
router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const id = crypto.randomUUID();
    const slug = slugify(body.slug || body.name);
    if (!slug) return res.status(400).json({ error: "A valid category slug is required." });
    const [order] = await pool.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM categories");
    await pool.execute("INSERT INTO categories (id, slug, name, description, image, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      id, slug, body.name.trim(), String(body.description || "").trim(), String(body.image || "").trim(), body.isActive === false ? 0 : 1,
      Number.isInteger(body.sortOrder) ? body.sortOrder : Number(order[0].next_order)
    ]);
    const [rows] = await pool.execute("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
    res.status(201).json({ category: map(rows[0]) });
  } catch (e) { if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A category with this slug already exists." }); next(e); }
});
router.put("/:id", async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validate(body, true);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const [found] = await pool.execute("SELECT * FROM categories WHERE id = ? LIMIT 1", [req.params.id]);
    if (!found.length) return res.status(404).json({ error: "Category not found." });
    const current = map(found[0]);
    const name = body.name === undefined ? current.name : body.name.trim();
    const slug = slugify(body.slug === undefined ? (body.name === undefined ? current.slug : name) : body.slug);
    if (!slug) return res.status(400).json({ error: "A valid category slug is required." });
    await pool.execute("UPDATE categories SET slug=?, name=?, description=?, image=?, is_active=?, sort_order=? WHERE id=?", [
      slug, name, body.description === undefined ? current.description : String(body.description).trim(),
      body.image === undefined ? current.image : String(body.image).trim(),
      body.isActive === undefined ? (current.isActive ? 1 : 0) : (body.isActive ? 1 : 0),
      body.sortOrder === undefined ? current.sortOrder : body.sortOrder, req.params.id
    ]);
    const [rows] = await pool.execute("SELECT * FROM categories WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ category: map(rows[0]) });
  } catch (e) { if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A category with this slug already exists." }); next(e); }
});
router.delete("/:id", async (req, res, next) => {
  try {
    const [used] = await pool.execute("SELECT COUNT(*) AS total FROM products WHERE category_id = ?", [req.params.id]);
    if (Number(used[0].total) > 0) return res.status(409).json({ error: "This category is assigned to products. Move those products to another category before deleting it." });
    const [result] = await pool.execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Category not found." });
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.put("/reorder", async (req, res, next) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== "string") || new Set(ids).size !== ids.length) return res.status(400).json({ error: "Provide a valid ordered list of category IDs." });
  let conn;
  try {
    conn = await pool.getConnection(); await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) await conn.execute("UPDATE categories SET sort_order=? WHERE id=?", [i, ids[i]]);
    await conn.commit(); res.json({ success: true });
  } catch (e) { if (conn) await conn.rollback(); next(e); }
  finally { conn?.release(); }
});
export default router;
