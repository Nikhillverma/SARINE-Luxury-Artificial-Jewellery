import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { ensureInventoryTable, recordInventoryMovement } from "./inventoryLedger.js";
import { validateBulkProductRequest } from "./bulkProductPolicy.js";
import { normalizeStringList, validateProductFields } from "./productPolicy.js";
import { ensureProductVariantSchema, mapVariant, syncProductVariantStock, recordVariantInventoryMovement } from "./productVariantSchema.js";
import { isValidVariantSku, formatVariantLabel } from "./productVariantPolicy.js";
import { ensureProductVideoColumn } from "./productVideoSchema.js";

const router = Router();
router.use(requireAdminAuth);

const STATUSES = new Set(["active", "draft", "archived"]);
const MEN_PRODUCT_TAG = "__sarine_men_catalogue__";
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
  const storedTags = parseJson(row.tags, []);
  const gender = Array.isArray(storedTags) && storedTags.includes(MEN_PRODUCT_TAG) ? "men" : "women";
  return {
    id: row.id, slug: row.slug, name: row.name,
    gender,
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
    tags: parseJson(row.tags, []).filter(tag => tag !== MEN_PRODUCT_TAG),
    baseMetal: row.base_metal || "",
    platingFinish: row.plating_finish || "",
    stoneType: row.stone_type || "",
    closureType: row.closure_type || "",
    careInstructions: parseJson(row.care_instructions, []),
    productVideoUrl: row.product_video_url || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateProduct(body, partial = false) {
  const errors = validateProductFields(body);
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 255) errors.push("Name is required and must be at most 255 characters.");
  }
  if (!partial || body.price !== undefined) {
    if (!Number.isFinite(Number(body.price)) || Number(body.price) < 0 || Number(body.price) > 99999999) errors.push("Price must be a valid non-negative amount.");
  }
  if (body.stock !== undefined && (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0)) errors.push("Stock must be a non-negative integer.");
  if (body.status !== undefined && !STATUSES.has(body.status)) errors.push("Status must be active, draft or archived.");
  for (const field of ["images", "collectionSlugs", "tags", "careInstructions"]) {
    if (body[field] !== undefined && !Array.isArray(body[field])) errors.push(field + " must be an array.");
  }
  if (body.productVideoUrl !== undefined) {
    if (typeof body.productVideoUrl !== "string" || body.productVideoUrl.length > 2048) errors.push("Product video URL must be text of 2048 characters or fewer.");
    else if (body.productVideoUrl.trim() && !/^https:\/\//i.test(body.productVideoUrl.trim())) errors.push("Product video URL must use HTTPS.");
  }
  return errors;
}

function valuesFromBody(body, existing = {}) {
  const get = (key, fallback = null) => body[key] !== undefined ? body[key] : (existing[key] ?? fallback);
  const name = get("name", "");
  const gender = get("gender", existing.gender || "women") === "men" ? "men" : "women";
  const tags = normalizeStringList(get("tags", [])).filter(tag => tag !== MEN_PRODUCT_TAG);
  if (gender === "men") tags.push(MEN_PRODUCT_TAG);
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
    collection_slugs: JSON.stringify(normalizeStringList(get("collectionSlugs", []))),
    jewellery_type: get("jewelleryType"),
    stock: Number(get("stock", 0)),
    status: get("status", "draft"),
    tags: JSON.stringify(tags),
    base_metal: get("baseMetal"),
    plating_finish: get("platingFinish"),
    stone_type: get("stoneType"),
    closure_type: get("closureType"),
    care_instructions: JSON.stringify(normalizeStringList(get("careInstructions", []))),
    product_video_url: get("productVideoUrl", "") || null
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
    const gender = req.query.gender === "men" || req.query.gender === "women" ? String(req.query.gender) : "";
    if (gender === "men") { conditions.push("JSON_CONTAINS(COALESCE(tags, '[]'), JSON_QUOTE(?))"); params.push(MEN_PRODUCT_TAG); }
    if (gender === "women") { conditions.push("NOT JSON_CONTAINS(COALESCE(tags, '[]'), JSON_QUOTE(?))"); params.push(MEN_PRODUCT_TAG); }
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
    await ensureProductVariantSchema();
    const ids = rows.map(row => row.id);
    const variantsByProduct = new Map();
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [variantRows] = await pool.execute(
        `SELECT * FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, option1_value ASC`,
        ids
      );
      for (const row of variantRows) {
        const list = variantsByProduct.get(row.product_id) || [];
        list.push(mapVariant(row));
        variantsByProduct.set(row.product_id, list);
      }
    }
    res.json({
      products: rows.map(row => ({ ...mapProduct(row), variants: (variantsByProduct.get(row.id) || []).filter(item => item.status === "active") })),
      total: Number(countRows[0].total), page, limit
    });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  let connection;
  try {
    await ensureProductVideoColumn();
    const body = req.body || {};
    const errors = validateProduct(body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const data = valuesFromBody(body);
    if (!data.slug) return res.status(400).json({ error: "A valid product slug could not be generated." });
    const id = crypto.randomUUID();

    await ensureInventoryTable();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO products
       (id, slug, name, description, short_description, price, compare_at_price, cost_price,
        images, category_id, collection_slugs, jewellery_type, stock, status, tags,
        base_metal, plating_finish, stone_type, closure_type, care_instructions, product_video_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [id, data.slug, data.name, data.description, data.short_description, data.price,
       data.compare_at_price, data.cost_price, data.images, data.category_id,
       data.collection_slugs, data.jewellery_type, data.stock, data.status, data.tags,
       data.base_metal, data.plating_finish, data.stone_type, data.closure_type, data.care_instructions, data.product_video_url]
    );

    if (data.stock > 0) {
      await recordInventoryMovement(connection, {
        productId: id,
        productName: data.name,
        previousStock: 0,
        quantityDelta: data.stock,
        newStock: data.stock,
        reason: "Initial product stock",
        actorId: req.admin?.id || "admin",
        actorName: req.admin?.name || req.admin?.email || "Atelier admin",
        actorEmail: req.admin?.email || "admin"
      });
    }

    const [rows] = await connection.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
    await connection.commit();
    res.status(201).json({ success: true, product: mapProduct(rows[0]) });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A product with this slug already exists." });
    next(error);
  } finally {
    connection?.release();
  }
});


router.get("/:id/preview", async (req, res, next) => {
  try {
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.set("Pragma", "no-cache");
    const [products] = await pool.execute(
      "SELECT * FROM products WHERE id = ? AND status IN ('active', 'draft') LIMIT 1",
      [req.params.id]
    );
    if (!products.length) return res.status(404).json({ error: "Product not found or archived." });
    await ensureProductVariantSchema();
    const [variants] = await pool.execute(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, option1_value ASC, option2_value ASC",
      [req.params.id]
    );
    res.json({
      product: {
        ...mapProduct(products[0]),
        variants: variants.map(mapVariant)
      },
      previewOnly: true,
      purchaseEnabled: false
    });
  } catch (error) { next(error); }
});

router.get("/:id/variants", async (req, res, next) => {
  try {
    await ensureProductVariantSchema();
    const [products] = await pool.execute("SELECT id FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    if (!products.length) return res.status(404).json({ error: "Product not found." });
    const [rows] = await pool.execute(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, option1_value ASC, option2_value ASC",
      [req.params.id]
    );
    res.set("Cache-Control", "no-store");
    res.json({ variants: rows.map(mapVariant) });
  } catch (error) { next(error); }
});

router.put("/:id/variants", async (req, res, next) => {
  let connection;
  try {
    const variants = req.body?.variants;
    if (!Array.isArray(variants) || variants.length < 1 || variants.length > 100) {
      return res.status(400).json({ error: "Provide between 1 and 100 product variants. Set unwanted options to inactive instead of removing the entire variant set." });
    }
    await ensureProductVariantSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [products] = await connection.execute(
      "SELECT id, name, price FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [req.params.id]
    );
    if (!products.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found." });
    }
    const product = products[0];
    const [existingRows] = await connection.execute(
      "SELECT * FROM product_variants WHERE product_id = ? FOR UPDATE",
      [req.params.id]
    );
    if (existingRows.length && variants.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Keep at least one variant. Set unwanted options to inactive instead of deleting them." });
    }

    const normalized = [];
    const ids = new Set();
    const skus = new Set();
    const combinations = new Set();
    for (let index = 0; index < variants.length; index += 1) {
      const item = variants[index] || {};
      const option1Name = String(item.option1Name || "").trim().slice(0, 60);
      const option1Value = String(item.option1Value || "").trim().slice(0, 100);
      const option2Name = String(item.option2Name || "").trim().slice(0, 60);
      const option2Value = String(item.option2Value || "").trim().slice(0, 100);
      const sku = String(item.sku || "").trim().toUpperCase();
      if (item.status !== undefined && !["active", "inactive"].includes(item.status)) {
        await connection.rollback();
        return res.status(400).json({ error: "Variant status must be active or inactive." });
      }
      const status = item.status === "inactive" ? "inactive" : "active";
      if (!option1Name || !option1Value || !isValidVariantSku(sku)) {
        await connection.rollback();
        return res.status(400).json({ error: "Every variant needs an option name, option value and unique SKU (2–100 letters, numbers, dots, underscores or hyphens)." });
      }
      if (Boolean(option2Name) !== Boolean(option2Value) || (option2Name && option2Name.toLowerCase() === option1Name.toLowerCase())) {
        await connection.rollback();
        return res.status(400).json({ error: "Second option name and value must both be filled, and option names must differ." });
      }
      if (skus.has(sku)) {
        await connection.rollback();
        return res.status(400).json({ error: "Variant SKUs must be unique." });
      }
      skus.add(sku);
      const combination = [option1Name, option1Value, option2Name, option2Value].join("|").toLowerCase();
      if (combinations.has(combination)) {
        await connection.rollback();
        return res.status(400).json({ error: "Duplicate variant option combinations are not allowed." });
      }
      combinations.add(combination);
      const id = item.id ? String(item.id) : crypto.randomUUID();
      if (ids.has(id)) {
        await connection.rollback();
        return res.status(400).json({ error: "Variant IDs must be unique." });
      }
      ids.add(id);
      const price = item.price === "" || item.price === undefined || item.price === null ? null : Number(item.price);
      const compareAtPrice = item.compareAtPrice === "" || item.compareAtPrice === undefined || item.compareAtPrice === null ? null : Number(item.compareAtPrice);
      const effectivePrice = price === null ? Number(product.price) : price;
      if ((price !== null && (!Number.isFinite(price) || price < 0 || price > 99999999)) ||
          (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice <= effectivePrice))) {
        await connection.rollback();
        return res.status(400).json({ error: "Variant price must be valid, and comparison price must exceed its effective selling price." });
      }
      const stock = Number(item.stock);
      if (!Number.isSafeInteger(stock) || stock < 0 || stock > 2147483647) {
        await connection.rollback();
        return res.status(400).json({ error: "Variant stock must be a non-negative whole number." });
      }
      const existing = existingRows.find(row => row.id === id);
      if (item.id && !existing) {
        await connection.rollback();
        return res.status(400).json({ error: "A submitted variant does not belong to this product." });
      }
      if (existing && Number(existing.stock) !== stock) {
        await connection.rollback();
        return res.status(400).json({ error: "Existing variant stock must be changed through Inventory so every movement is audited." });
      }
      normalized.push({ id, option1Name, option1Value, option2Name: option2Name || null, option2Value: option2Value || null, sku, price, compareAtPrice, stock, status, sortOrder: Number.isInteger(Number(item.sortOrder)) ? Number(item.sortOrder) : index, isNew: !existing });
    }
    if (normalized.length && !normalized.some(item => item.status === "active")) {
      await connection.rollback();
      return res.status(400).json({ error: "At least one variant must remain active." });
    }

    for (const item of normalized) {
      if (item.isNew) {
        await connection.execute(
          `INSERT INTO product_variants
           (id, product_id, option1_name, option1_value, option2_name, option2_value, sku, price, compare_at_price, stock, status, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
          [item.id, req.params.id, item.option1Name, item.option1Value, item.option2Name, item.option2Value, item.sku, item.price, item.compareAtPrice, item.stock, item.status, item.sortOrder]
        );
        // New variant opening balances must be visible in the variant movement ledger.
        if (item.stock > 0) {
          await recordVariantInventoryMovement(connection, {
            variantId: item.id,
            productId: req.params.id,
            productName: product.name,
            variantSku: item.sku,
            variantLabel: formatVariantLabel(item.option1Name, item.option1Value, item.option2Name, item.option2Value),
            previousStock: 0,
            quantityDelta: item.stock,
            newStock: item.stock,
            reason: "Initial variant stock",
            adminId: req.admin?.id || "admin",
            adminName: req.admin?.name || req.admin?.email || "Atelier admin",
            adminEmail: req.admin?.email || "admin"
          });
        }
      } else {
        await connection.execute(
          `UPDATE product_variants SET option1_name=?, option1_value=?, option2_name=?, option2_value=?,
           sku=?, price=?, compare_at_price=?, status=?, sort_order=?, updated_at=UTC_TIMESTAMP(3)
           WHERE id=? AND product_id=?`,
          [item.option1Name, item.option1Value, item.option2Name, item.option2Value, item.sku, item.price, item.compareAtPrice, item.status, item.sortOrder, item.id, req.params.id]
        );
      }
    }
    if (existingRows.length) {
      const submittedIds = normalized.map(item => item.id);
      const omitted = existingRows.filter(row => !submittedIds.includes(row.id)).map(row => row.id);
      if (omitted.length) {
        const placeholders = omitted.map(() => "?").join(",");
        await connection.execute(
          `UPDATE product_variants SET status='inactive', updated_at=UTC_TIMESTAMP(3) WHERE product_id=? AND id IN (${placeholders})`,
          [req.params.id, ...omitted]
        );
      }
    }
    await syncProductVariantStock(connection, req.params.id);
    const [savedRows] = await connection.execute(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC, option1_value ASC",
      [req.params.id]
    );
    await connection.commit();
    res.set("Cache-Control", "no-store");
    res.json({ success: true, variants: savedRows.map(mapVariant), stock: savedRows.filter(row => row.status === "active").reduce((sum, row) => sum + Number(row.stock), 0) });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That variant SKU is already used. Each variant needs a unique SKU." });
    next(error);
  } finally {
    connection?.release();
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    await ensureProductVideoColumn();
    const body = req.body || {};
    const errors = validateProduct(body, true);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const [existingRows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: "Product not found." });
    const existing = mapProduct(existingRows[0]);
    const finalPrice = body.price === undefined ? existing.price : Number(body.price);
    const finalCompareAtPrice = body.compareAtPrice === undefined ? existing.compareAtPrice : body.compareAtPrice;
    if (finalCompareAtPrice != null && Number(finalCompareAtPrice) <= finalPrice) {
      return res.status(400).json({ error: "Comparison price must be higher than the selling price." });
    }
    if (body.stock !== undefined && Number(body.stock) !== existing.stock) {
      return res.status(400).json({ error: "Use Inventory & Physical Stock Control to adjust stock so the change is recorded in inventory history." });
    }
    const data = valuesFromBody(body, existing);
    if (!data.slug) return res.status(400).json({ error: "A valid product slug is required." });
    await pool.execute(
      `UPDATE products SET slug=?, name=?, description=?, short_description=?, price=?,
       compare_at_price=?, cost_price=?, images=?, category_id=?, collection_slugs=?,
       jewellery_type=?, stock=?, status=?, tags=?, base_metal=?, plating_finish=?,
       stone_type=?, closure_type=?, care_instructions=?, product_video_url=?, updated_at=CURRENT_TIMESTAMP(3)
       WHERE id=?`,
      [data.slug, data.name, data.description, data.short_description, data.price,
       data.compare_at_price, data.cost_price, data.images, data.category_id,
       data.collection_slugs, data.jewellery_type, data.stock, data.status, data.tags,
       data.base_metal, data.plating_finish, data.stone_type, data.closure_type,
       data.care_instructions, data.product_video_url, req.params.id]
    );
    const [rows] = await pool.execute("SELECT * FROM products WHERE id = ? LIMIT 1", [req.params.id]);
    res.json({ success: true, product: mapProduct(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A product with this slug already exists." });
    next(error);
  }
});


router.post("/bulk", async (req, res, next) => {
  let connection;
  try {
    const { productIds, updates } = req.body || {};
    const validation = validateBulkProductRequest(productIds, updates);
    if (validation) return res.status(400).json({ error: validation });

    if (updates.categoryId !== undefined) {
      const [categories] = await pool.execute(
        "SELECT id FROM categories WHERE id = ? LIMIT 1",
        [updates.categoryId]
      );
      if (!categories.length) return res.status(400).json({ error: "Choose an existing category." });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const placeholders = productIds.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT id, name, status, price, compare_at_price
       FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
      productIds
    );
    const byId = new Map(rows.map(row => [row.id, row]));
    const results = [];

    for (const id of productIds) {
      const product = byId.get(id);
      if (!product) {
        results.push({ productId: id, status: "not_found", message: "Product no longer exists." });
        continue;
      }
      if (product.status === "archived") {
        results.push({ productId: id, productName: product.name, status: "skipped", message: "Archived products cannot be bulk edited." });
        continue;
      }

      const nextPrice = updates.price !== undefined ? updates.price : Number(product.price);
      const nextCompareAt = updates.compareAtPrice !== undefined ? updates.compareAtPrice : (product.compare_at_price == null ? null : Number(product.compare_at_price));
      if (nextCompareAt !== null && nextCompareAt <= nextPrice) {
        results.push({ productId: id, productName: product.name, status: "skipped", message: "Comparison price must be higher than the selling price." });
        continue;
      }

      const columns = [];
      const values = [];
      if (updates.price !== undefined) { columns.push("price = ?"); values.push(updates.price); }
      if (updates.compareAtPrice !== undefined) { columns.push("compare_at_price = ?"); values.push(updates.compareAtPrice); }
      if (updates.categoryId !== undefined) { columns.push("category_id = ?"); values.push(updates.categoryId); }
      if (updates.status !== undefined) { columns.push("status = ?"); values.push(updates.status); }
      columns.push("updated_at = CURRENT_TIMESTAMP(3)");
      values.push(id);
      await connection.execute(
        `UPDATE products SET ${columns.join(", ")} WHERE id = ?`,
        values
      );
      results.push({ productId: id, productName: product.name, status: "updated", message: "Changes saved." });
    }

    await connection.commit();
    const updated = results.filter(item => item.status === "updated").length;
    res.json({
      success: true,
      summary: { requested: productIds.length, updated, skipped: results.length - updated },
      results
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    next(error);
  } finally {
    connection?.release();
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
