import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

// Read-only, narrowly scoped diagnostic for the known affected catalogue item.
// HEX(description) reports the bytes MariaDB stores; no product fields are modified.
router.get("/:id/encoding-diagnostic", async (req, res, next) => {
  if (req.params.id !== "prod-004") {
    return res.status(404).json({ error: "Diagnostic is not enabled for this product." });
  }

  try {
    res.set("Cache-Control", "no-store");
    const [rows] = await pool.execute(
      `SELECT id, slug, name, description,
              HEX(description) AS description_hex,
              CHARSET(description) AS description_charset,
              COLLATION(description) AS description_collation,
              LENGTH(description) AS description_byte_length,
              CHAR_LENGTH(description) AS description_char_length
       FROM products
       WHERE id = ?
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Product not found." });
    }

    const row = rows[0];
    const description = row.description || "";
    const descriptionCodePoints = Array.from(description, (character) => ({
      character,
      codePoint: "U+" + character.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")
    }));

    return res.json({
      product: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description
      },
      storage: {
        hex: row.description_hex,
        charset: row.description_charset,
        collation: row.description_collation,
        byteLength: Number(row.description_byte_length),
        characterLength: Number(row.description_char_length)
      },
      decodedCodePoints: descriptionCodePoints
    });
  } catch (error) {
    next(error);
  }
});

const STATUSES = new Set(["active", "draft", "archived"]);
const parseJson = (value, fallback) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
const slugify = (value) => String(value || "")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  .slice(0, 180);

function mapProduct(row) {
  return {
    id: row.id, slug: row.slug, name: row.name,
    description: row.description || "",
    shortDescription: row.short_description || "",
    price: Number(row.price),
    compareAtPrice: row.compare_at_price == null ? undefined : Number(row.compare_at_price),
    costPrice: row.cost_price == null ? undefined : Number(row.cost_price),
    images: parseJson(row.images, []),
    categoryId: row.category_id || "",
    collectionSlugs: parseJson(row.collection_slugs, []),
    jewelleryType: row.jewellery_type || "",
    stock: Number(row.stock),
    status: row.status,
    tags: parseJson(row.tags, []),
    baseMetal: row.base_metal || "",
    platingFinish: row.plating_finish || "",
    stoneType: row.stone_type || "",
    closureType: row.closure_type || "",
    careInstructions: parseJson(row.care_instructions, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateProduct(body, partial = false) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 255) errors.push("Name is required and must be at most 255 characters.");
  }
  if (!partial || body.price !== undefined) {
    if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0) errors.push("Price must be a non-negative number.");
  }
  if (body.stock !== undefined && (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)) errors.push("Stock must be a non-negative integer.");
  if (body.status !== undefined && !STATUSES.has(body.status)) errors.push("Status must be active, draft or archived.");
  for (const field of ["images", "collectionSlugs", "tags", "careInstructions"]) {
    if (body[field] !== undefined && !Array.isArray(body[field])) errors.push(field + " must be an array.");
  }
  return errors;
}

function valuesFromBody(body, existing = {}) {
  const get = (key, fallback = null) => body[key] !== undefined ? body[key] : (existing[key] ?? fallback);
  const name = get("name", "");
  return {
    name: String(name).trim(),
    slug: slugify(get("slug", name)),
    description: get("description", ""),
    short_description: get("shortDescription", ""),
    price: Number(get("price", 0)),
    compare_at_price: get("compareAtPrice"),
    cost_price: get("costPrice"),
    images: JSON.stringify(get("images", [])),
    category_id: get("categoryId"),
    collection_slugs: JSON.stringify(get("collectionSlugs", [])),
    jewellery_type: get("jewelleryType"),
    stock: Number(get("stock", 0)),
    status: get("status", "draft"),
    tags: JSON.stringify(get("tags", [])),
    base_metal: get("baseMetal"),
    plating_finish: get("platingFinish"),
    stone_type: get("stoneType"),
    closure_type: get("closureType"),
    care_instructions: JSON.stringify(get("careInstructions", []))
  };
}

router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const status = req.query.status ? String(req.query.status) : "all";
    const search = req.query.search ? String(req.query.search).trim().slice(0, 100) : "";
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const conditions = [];
    const params = [];
    if (status !== "all") {
      if (!STATUSES.has(status)) return res.status(400).json({ error: "Invalid product status." });
      conditions.push("status = ?");
      params.push(status);
    }
    if (search) {
      conditions.push("(name LIKE ? OR slug LIKE ?)");
      params.push("%" + search + "%", "%" + search + "%");
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const [[countRows], [rows]] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS total FROM products " + where, params),
      pool.execute("SELECT * FROM products " + where + " ORDER BY updated_at DESC, name ASC LIMIT ? OFFSET ?", [...params, limit, (page - 1) * limit])
    ]);
    res.json({ products: rows.map(mapProduct), total: Number(countRows[0].total), page, limit });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validateProduct(body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const data = valuesFromBody(body);
    if (!data.slug) return res.status(400).json({ error: "A valid product slug could not be generated." });
    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO products
       (id, slug, name, description, short_description, price, compare_at_price, cost_price,
        images, category_id, collection_slugs, jewellery_type, stock, status, tags,
        base_metal, plating_finish, stone_type, closure_type, care_instructions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [id, data.slug, data.name, data.description, data.short_description, data.price,
       data.compare_at_price, data.cost_price, data.images, data.category_id,
       data.collection_slugs, data.jewellery_type, data.stock, data.status, data.tags,
       data.base_metal, data.plating_finish, data.stone_type, data.closure_type, data.care_instructions]
    );
    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    res.status(201).json({ success: true, product: mapProduct(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A product with this slug already exists." });
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const body = req.body || {};
    const errors = validateProduct(body, true);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const [existingRows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: "Product not found." });
    const existing = mapProduct(existingRows[0]);
    const data = valuesFromBody(body, existing);
    if (!data.slug) return res.status(400).json({ error: "A valid product slug is required." });
    await pool.execute(
      `UPDATE products SET slug=?, name=?, description=?, short_description=?, price=?,
       compare_at_price=?, cost_price=?, images=?, category_id=?, collection_slugs=?,
       jewellery_type=?, stock=?, status=?, tags=?, base_metal=?, plating_finish=?,
       stone_type=?, closure_type=?, care_instructions=?, updated_at=CURRENT_TIMESTAMP(3)
       WHERE id=?`,
      [data.slug, data.name, data.description, data.short_description, data.price,
       data.compare_at_price, data.cost_price, data.images, data.category_id,
       data.collection_slugs, data.jewellery_type, data.stock, data.status, data.tags,
       data.base_metal, data.plating_finish, data.stone_type, data.closure_type,
       data.care_instructions, req.params.id]
    );
    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ success: true, product: mapProduct(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A product with this slug already exists." });
    next(error);
  }
});

router.patch("/:id/archive", async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      "UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Product not found." });

    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ success: true, product: mapProduct(rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!STATUSES.has(status)) return res.status(400).json({ error: "Status must be active, draft or archived." });
    const [result] = await pool.execute(
      "UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [status, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true, id: req.params.id, status });
  } catch (error) { next(error); }
});

export default router;
