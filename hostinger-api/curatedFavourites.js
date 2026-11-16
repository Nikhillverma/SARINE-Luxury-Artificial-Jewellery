import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const admin = Router();
const publicRouter = Router();
const adminOnly = Router();
adminOnly.use(requireAdminAuth);

const MAX_CURATED_PRODUCTS = 12;
const EMPTY_CURATION = Object.freeze({ version: 1, productIds: [], configured: false });

export function validateCuratedFavourites(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.productIds)) {
    throw new Error("Curated Favourites must contain a productIds array.");
  }
  if (input.productIds.length > MAX_CURATED_PRODUCTS) {
    throw new Error(`Choose no more than ${MAX_CURATED_PRODUCTS} products.`);
  }
  const productIds = input.productIds.map((id) => {
    if (typeof id !== "string" || !id.trim() || id.trim().length > 64) {
      throw new Error("Every curated product must have a valid product ID.");
    }
    return id.trim();
  });
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("A product cannot be added to Curated Favourites more than once.");
  }
  return { version: 1, productIds, configured: true };
}

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

function mapPublicProduct(row) {
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

adminOnly.get("/", async (_req, res, next) => {
  try {
    const [draft, published] = await Promise.all([
      readCuration("curated_favourites_draft"),
      readCuration("curated_favourites_published")
    ]);
    res.set("Cache-Control", "no-store").json({ draft, published, maxProducts: MAX_CURATED_PRODUCTS });
  } catch (error) { next(error); }
});

adminOnly.put("/draft", async (req, res, next) => {
  try {
    const draft = validateCuratedFavourites(req.body);
    await writeCuration("curated_favourites_draft", draft);
    res.set("Cache-Control", "no-store").json({ success: true, draft });
  } catch (error) {
    if (error instanceof Error && /curated|product|choose|valid|added/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

adminOnly.post("/publish", async (_req, res, next) => {
  try {
    const draft = await readCuration("curated_favourites_draft");
    await writeCuration("curated_favourites_published", draft);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft });
  } catch (error) { next(error); }
});

publicRouter.get("/", async (_req, res, next) => {
  try {
    const curation = await readCuration("curated_favourites_published");
    if (!curation.productIds.length) {
      res.set("Cache-Control", "no-store").json({ products: [], configured: curation.configured === true });
      return;
    }
    const placeholders = curation.productIds.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT * FROM products WHERE id IN (${placeholders}) AND status='active' AND stock > 0`,
      curation.productIds
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
