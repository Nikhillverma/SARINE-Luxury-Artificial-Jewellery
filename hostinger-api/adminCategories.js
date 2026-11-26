import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { ensureCategoryCollectionSchema } from "./categoryCollectionSchema.js";
import { ensureCategoryHierarchySchema } from "./categoryHierarchySchema.js";

const router = Router();
router.use(requireAdminAuth);
router.use(async (_req, _res, next) => {
  try { await ensureCategoryCollectionSchema(); await ensureCategoryHierarchySchema(); next(); }
  catch (error) { next(error); }
});

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
    sortOrder: Number(row.sort_order),
    categoryCollection: ["artificial", "demi-fine", "both"].includes(row.category_collection) ? row.category_collection : "both",
    parentCategoryId: row.parent_category_id || null
  };
}

function validate(body, partial = false) {
  const errors = [];
  if (body.categoryCollection !== undefined && !["artificial", "demi-fine", "both"].includes(body.categoryCollection)) {
    errors.push("Choose Artificial, Demi-Fine or Shared for this category.");
  }
  if (body.parentCategoryId !== undefined && body.parentCategoryId !== null &&
      (typeof body.parentCategoryId !== "string" || !body.parentCategoryId.trim() || body.parentCategoryId.length > 64)) {
    errors.push("Choose a valid parent category or leave this category at the top level.");
  }
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

async function validateParentCategory(parentId, categoryId, collection) {
  if (!parentId) return null;
  if (String(parentId) === String(categoryId || "")) {
    return "A category cannot be its own parent.";
  }
  const [rows] = await pool.execute(
    "SELECT id, parent_category_id, is_active, category_collection FROM categories WHERE id = ? LIMIT 1",
    [parentId]
  );
  if (!rows.length) return "The selected parent category does not exist.";
  const parent = rows[0];
  if (parent.parent_category_id) return "Subcategories can only be one level deep. Choose a top-level parent.";
  if (!parent.is_active) return "The selected parent category is hidden. Publish it before adding subcategories.";
  if (parent.category_collection !== "both" && collection !== "both" && parent.category_collection !== collection) {
    return "The subcategory and its parent must belong to the same collection, or the parent must be Shared.";
  }
  return null;
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
    const categoryCollection = body.categoryCollection || "both";
    const parentError = await validateParentCategory(body.parentCategoryId || null, null, categoryCollection);
    if (parentError) return res.status(400).json({ error: parentError });
    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO categories (id, slug, name, description, image, is_active, sort_order, category_collection, parent_category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, slug, name, body.description?.trim() || "", body.image || "",
       body.isActive === false ? 0 : 1, Number(body.sortOrder ?? 0), categoryCollection, body.parentCategoryId || null]
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
    const categoryCollection = body.categoryCollection === undefined ? existing.categoryCollection : body.categoryCollection;
    const parentCategoryId = body.parentCategoryId === undefined ? existing.parentCategoryId : (body.parentCategoryId || null);
    const parentError = await validateParentCategory(parentCategoryId, req.params.id, categoryCollection);
    if (parentError) return res.status(400).json({ error: parentError });
    const [[childRows]] = await pool.execute(
      "SELECT COUNT(*) AS childCount, SUM(CASE WHEN category_collection NOT IN (?, 'both') THEN 1 ELSE 0 END) AS incompatibleCount FROM categories WHERE parent_category_id = ?",
      [categoryCollection, req.params.id]
    );
    if (parentCategoryId && Number(childRows.childCount) > 0) {
      return res.status(409).json({ error: "A category with subcategories cannot itself become a subcategory. Move its subcategories first." });
    }
    if (Number(childRows.incompatibleCount || 0) > 0) {
      return res.status(409).json({ error: "This collection change would conflict with one or more subcategories. Update or move those subcategories first." });
    }
    const name = body.name === undefined ? existing.name : body.name.trim();
    const slug = slugify(body.slug === undefined ? (body.name === undefined ? existing.slug : name) : body.slug);
    if (!slug) return res.status(400).json({ error: "A valid category slug is required." });
    await pool.execute(
      `UPDATE categories
       SET slug = ?, name = ?, description = ?, image = ?, is_active = ?, sort_order = ?, category_collection = ?, parent_category_id = ?
       WHERE id = ?`,
      [slug, name, body.description === undefined ? existing.description : body.description.trim(),
       body.image === undefined ? existing.image : body.image,
       body.isActive === undefined ? (existing.isActive ? 1 : 0) : (body.isActive ? 1 : 0),
       body.sortOrder === undefined ? existing.sortOrder : Number(body.sortOrder),
       categoryCollection, parentCategoryId,
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
    const [[children]] = await connection.execute(
      "SELECT COUNT(*) AS childCount FROM categories WHERE parent_category_id = ?", [req.params.id]
    );
    if (Number(children.childCount) > 0) {
      await connection.rollback();
      return res.status(409).json({
        error: "This category has subcategories. Reassign or remove its subcategories before deleting the parent.",
        childCount: Number(children.childCount)
      });
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
