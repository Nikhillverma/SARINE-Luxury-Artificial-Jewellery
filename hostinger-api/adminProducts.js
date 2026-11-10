import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

const JEWELLERY_TYPES = new Set(["earrings", "necklace", "bracelet", "ring", "anklet", "set"]);
const STATUSES = new Set(["active", "draft", "archived"]);

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
}

function mapProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    shortDescription: row.short_description || "",
    price: Number(row.price),
    ...(row.compare_at_price == null ? {} : { compareAtPrice: Number(row.compare_at_price) }),
    ...(row.cost_price == null ? {} : { costPrice: Number(row.cost_price) }),
    images: parseArray(row.images),
    categoryId: row.category_id || "",
    collectionSlugs: parseArray(row.collection_slugs),
    jewelleryType: row.jewellery_type || "necklace",
    stock: Number(row.stock),
    status: row.status,
    tags: parseArray(row.tags),
    ...(row.base_metal ? { baseMetal: row.base_metal } : {}),
    ...(row.plating_finish ? { platingFinish: row.plating_finish } : {}),
    ...(row.stone_type ? { stoneType: row.stone_type } : {}),
    ...(row.closure_type ? { closureType: row.closure_type } : {}),
    careInstructions: parseArray(row.care_instructions),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function validateProduct(input) {
  const name = String(input.name || "").trim();
  const slug = String(input.slug || "").trim().toLowerCase();
  const price = Number(input.price);
  const stock = Number(input.stock);
  const jewelleryType = String(input.jewelleryType || "");
  const status = String(input.status || "draft");
  if (!name || name.length > 255) return "Product name is required (maximum 255 characters).";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 191) return "Enter a valid product URL slug.";
  if (!Number.isFinite(price) || price < 0 || price > 999999999) return "Enter a valid selling price.";
  if (!Number.isInteger(stock) || stock < 0 || stock > 2147483647) return "Stock must be a non-negative whole number.";
  if (!JEWELLERY_TYPES.has(jewelleryType)) return "Select a valid jewellery type.";
  if (!STATUSES.has(status)) return "Select a valid product status.";
  if (!input.categoryId || typeof input.categoryId !== "string") return "Select a product category.";
  for (const key of ["images", "collectionSlugs", "tags", "careInstructions"]) {
    if (input[key] !== undefined && (!Array.isArray(input[key]) || input[key].some(v => typeof v !== "string"))) {
      return key + " must be a list of text values.";
    }
  }
  if (input.images && input.images.length > 10) return "A product can have at most 10 images.";
  if (input.images && input.images.some(url => url.length > 2048 || !/^https:\/\//i.test(url))) return "Product image URLs must use HTTPS.";
  return null;
}

function dbValues(product) {
  return [
    product.slug,
    product.name,
    product.description || "",
    product.shortDescription || null,
    Number(product.price),
    product.compareAtPrice == null || product.compareAtPrice === "" ? null : Number(product.compareAtPrice),
    product.costPrice == null || product.costPrice === "" ? null : Number(product.costPrice),
    JSON.stringify(product.images || []),
    product.categoryId,
    JSON.stringify(product.collectionSlugs || []),
    product.jewelleryType,
    Number(product.stock),
    product.status,
    JSON.stringify(product.tags || []),
    product.baseMetal || null,
    product.platingFinish || null,
    product.stoneType || null,
    product.closureType || null,
    JSON.stringify(product.careInstructions || [])
  ];
}

async function validateCategory(categoryId) {
  const [rows] = await pool.execute("SELECT id FROM categories WHERE id = ? LIMIT 1", [categoryId]);
  return rows.length > 0;
}

// GET /api/admin/products — all statuses, admin session required.
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all");
    const conditions = [];
    const values = [];
    if (search) {
      conditions.push("(name LIKE ? OR slug LIKE ? OR id LIKE ?)");
      const term = "%" + search + "%";
      values.push(term, term, term);
    }
    if (status !== "all" && STATUSES.has(status)) {
      conditions.push("status = ?");
      values.push(status);
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const [rows] = await pool.execute(
      `SELECT * FROM products ${where} ORDER BY created_at DESC, name ASC LIMIT 500`,
      values
    );
    return res.json({ products: rows.map(mapProduct), total: rows.length });
  } catch (error) { next(error); }
});

// POST /api/admin/products
router.post("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const input = req.body || {};
    const error = validateProduct(input);
    if (error) return res.status(400).json({ error });
    if (!(await validateCategory(input.categoryId))) return res.status(400).json({ error: "Selected category does not exist." });
    const id = "prod-" + crypto.randomUUID();
    const values = dbValues(input);
    await pool.execute(
      `INSERT INTO products
       (id, slug, name, description, short_description, price, compare_at_price, cost_price,
        images, category_id, collection_slugs, jewellery_type, stock, status, tags,
        base_metal, plating_finish, stone_type, closure_type, care_instructions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [id, ...values]
    );
    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    return res.status(201).json({ product: mapProduct(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A product with this URL slug already exists. Change the product title." });
    next(error);
  }
});

// PUT /api/admin/products/:id
router.put("/:id", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const [existingRows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: "Product not found." });
    const current = mapProduct(existingRows[0]);
    const input = { ...current, ...(req.body || {}), id: current.id, createdAt: current.createdAt };
    const error = validateProduct(input);
    if (error) return res.status(400).json({ error });
    if (!(await validateCategory(input.categoryId))) return res.status(400).json({ error: "Selected category does not exist." });
    const values = dbValues(input);
    await pool.execute(
      `UPDATE products SET
       slug = ?, name = ?, description = ?, short_description = ?, price = ?, compare_at_price = ?,
       cost_price = ?, images = ?, category_id = ?, collection_slugs = ?, jewellery_type = ?,
       stock = ?, status = ?, tags = ?, base_metal = ?, plating_finish = ?, stone_type = ?,
       closure_type = ?, care_instructions = ?, updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [...values, req.params.id]
    );
    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    return res.json({ product: mapProduct(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A product with this URL slug already exists." });
    next(error);
  }
});

// Archive instead of hard-deleting catalogue records or historical references.
router.patch("/:id/archive", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const [result] = await pool.execute(
      "UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Product not found." });
    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    return res.json({ product: mapProduct(rows[0]) });
  } catch (error) { next(error); }
});

export default router;
