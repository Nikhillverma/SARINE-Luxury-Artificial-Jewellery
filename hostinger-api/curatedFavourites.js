import { Router } from "express";
import { ensureProductCollectionSchema } from "./productCollectionSchema.js";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { MAX_CURATED_PRODUCTS, EMPTY_CURATED_FAVOURITES as EMPTY_CURATION, validateCuratedFavourites } from "./curatedFavouritesPolicy.js";

const admin = Router();
const publicRouter = Router();
const adminOnly = Router();
adminOnly.use(requireAdminAuth);


let schemaReady;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

async function readCuration(key) {
  await ensureSchema();
  const [rows] = await pool.execute(
    "SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1",
    [key]
  );
  if (!rows.length) return EMPTY_CURATION;
  try {
    return validateCuratedFavourites(JSON.parse(rows[0].setting_value));
  } catch {
    return EMPTY_CURATION;
  }
}

async function writeCuration(key, value) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(value)]
  );
}

export function mapPublicProduct(row) {
  let images = [];
  let tags = [];
  let collectionSlugs = [];
  try { images = row.images ? JSON.parse(row.images) : []; } catch {}
  try { tags = row.tags ? JSON.parse(row.tags) : []; } catch {}
  try { collectionSlugs = row.collection_slugs ? JSON.parse(row.collection_slugs) : []; } catch {}
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    productCollection: row.product_collection || undefined,
    description: row.description || "",
    shortDescription: row.short_description || "",
    price: Number(row.price),
    compareAtPrice: row.compare_at_price == null ? undefined : Number(row.compare_at_price),
    images,
    categoryId: row.category_id || "",
    collectionSlugs,
    jewelleryType: row.jewellery_type || "",
    stock: Number(row.stock),
    status: row.status,
    tags,
    createdAt: row.created_at
  };
}

function collectionFrom(value) { const v = String(value || "").trim().toLowerCase(); if (!v) return null; if (v !== "artificial" && v !== "demi-fine") throw new Error("Product collection must be artificial or demi-fine."); return v; }
function collectionKey(base, collection) { return collection ? base + "_" + collection : base; }
export async function validateCollectionProductIds(productIds, collection) {
  if (!collection || !productIds.length) return null;
  await ensureProductCollectionSchema();
  const placeholders = productIds.map(() => "?").join(",");
  const [rows] = await pool.execute(
    `SELECT id FROM products WHERE id IN (${placeholders}) AND product_collection = ?`,
    [...productIds, collection]
  );
  return rows.length === productIds.length ? null : "Every selected product must belong to the chosen homepage range.";
}

adminOnly.get("/", async (req, res, next) => {
  try {
    const [draft, published] = await Promise.all([
      readCuration(collectionKey("curated_favourites_draft", collectionFrom(req.query.productCollection))),
      readCuration(collectionKey("curated_favourites_published", collectionFrom(req.query.productCollection)))
    ]);
    res.set("Cache-Control", "no-store").json({ draft, published, maxProducts: MAX_CURATED_PRODUCTS });
  } catch (error) { next(error); }
});

adminOnly.put("/draft", async (req, res, next) => {
  try {
    const draft = validateCuratedFavourites(req.body);
    const collection = collectionFrom(req.body?.productCollection);
    const collectionError = await validateCollectionProductIds(draft.productIds, collection);
    if (collectionError) return res.status(400).json({ error: collectionError });
    await writeCuration(collectionKey("curated_favourites_draft", collection), draft);
    res.set("Cache-Control", "no-store").json({ success: true, draft });
  } catch (error) {
    if (error instanceof Error && /curated|product|choose|valid|added/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

adminOnly.post("/publish", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const draft = await readCuration(collectionKey("curated_favourites_draft", collection));
    await writeCuration(collectionKey("curated_favourites_published", collection), draft);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft });
  } catch (error) { next(error); }
});

publicRouter.get("/", async (req, res, next) => {
  try {
    await ensureProductCollectionSchema();
    const productCollection = collectionFrom(req.query.productCollection);
    const curation = await readCuration(collectionKey("curated_favourites_published", productCollection));
    if (!curation.productIds.length) {
      res.set("Cache-Control", "no-store").json({ products: [], configured: curation.configured === true });
      return;
    }
    const placeholders = curation.productIds.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT * FROM products WHERE id IN (${placeholders}) AND status='active' AND stock > 0
         AND (? = '' OR product_collection = ?)`,
      [...curation.productIds, productCollection || "", productCollection || ""]
    );
    const byId = new Map(rows.map((row) => [String(row.id), row]));
    const products = curation.productIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(mapPublicProduct);
    res.set("Cache-Control", "no-store").json({ products, configured: curation.configured === true });
  } catch (error) { next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicCuratedFavouritesRouter };
export default admin;
