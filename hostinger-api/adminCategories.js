import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

const slugify = value => String(value || "")
  .normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "").slice(0, 180);

function mapCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    image: row.image || "",
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order)
  };
}

function validate(body, partial = false) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
      errors.push("Category name is required and must be at most 120 characters.");
    }
  }
  if (body.description !== undefined &&
      (typeof body.description !== "string" || body.description.length > 2000)) {
    errors.push("Description must be at most 2,000 characters.");
  }
  if (body.image !== undefined &&
      (typeof body.image !== "string" || body.image.length > 2048)) {
    errors.push("Image URL is invalid or too long.");
  }
  if (body.sortOrder !== undefined &&
      (!Number.isInteger(Number(body.sortOrder)) || Number(body.sortOrder) < 0 || Number(body.sortOrder) > 100000)) {
    errors.push("Display order must be a whole number between 0 and 100,000.");
  }
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    errors.push("Published status must be true or false.");
  }
  return errors;
}

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const [rows] = await pool.execute(
      "SELECT * FROM categories ORDER BY sort_order ASC, name ASC"
    );
    res.json({ categories: rows.map(mapCategory) });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const name = body.name.trim();
    const slug = slugify(body.slug || name);
    if (!slug) return res.status(400).json({ error: "A valid category slug is required." });
    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO categories (id, slug, name, description, image, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, slug, name, body.description?.trim() || "", body.image || "",
       body.isActive === false ? 0 : 1, Number(body.sortOrder ?? 0)]
    );
    const [rows] = await pool.execute("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
    res.status(201).json({ success: true, category: mapCategory(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A category with this slug already exists." });
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validate(body, true);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const [existingRows] = await pool.execute("SELECT * FROM categories WHERE id = ? LIMIT 1", [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: "Category not found." });
    const existing = mapCategory(existingRows[0]);
    const name = body.name === undefined ? existing.name : body.name.trim();
    const slug = slugify(body.slug === undefined ? (body.name === undefined ? existing.slug : name) : body.slug);
    if (!slug) return res.status(400).json({ error: "A valid category slug is required." });
    await pool.execute(
      `UPDATE categories
       SET slug = ?, name = ?, description = ?, image = ?, is_active = ?, sort_order = ?
       WHERE id = ?`,
      [slug, name, body.description === undefined ? existing.description : body.description.trim(),
       body.image === undefined ? existing.image : body.image,
       body.isActive === undefined ? (existing.isActive ? 1 : 0) : (body.isActive ? 1 : 0),
       body.sortOrder === undefined ? existing.sortOrder : Number(body.sortOrder),
       req.params.id]
    );
    const [rows] = await pool.execute("SELECT * FROM categories WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ success: true, category: mapCategory(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A category with this slug already exists." });
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [categoryRows] = await connection.execute(
      "SELECT id, name FROM categories WHERE id = ? FOR UPDATE", [req.params.id]
    );
    if (!categoryRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Category not found." });
    }
    const [[usage]] = await connection.execute(
      "SELECT COUNT(*) AS productCount FROM products WHERE category_id = ?", [req.params.id]
    );
    if (Number(usage.productCount) > 0) {
      await connection.rollback();
      return res.status(409).json({
        error: "This category is assigned to " + Number(usage.productCount) +
          " product(s). Reassign those products before deleting the category.",
        productCount: Number(usage.productCount)
      });
    }
    await connection.execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
    await connection.commit();
    res.json({ success: true, deletedId: req.params.id });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
  }
});

export default router;
