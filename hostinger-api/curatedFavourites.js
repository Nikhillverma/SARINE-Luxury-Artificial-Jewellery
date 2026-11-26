import { Router } from "express";
import { ensureProductCollectionSchema } from "./productCollectionSchema.js";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { MAX_CURATED_PRODUCTS, EMPTY_CURATED_FAVOURITES as EMPTY_CURATION, validateCuratedFavourites } from "./curatedFavouritesPolicy.js";
import { createEditorialSchedule, normalizeEditorialSchedule, getEditorialScheduleStatus, getEffectiveEditorial } from "./editorialSchedulePolicy.js";

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

async function readSetting(key) {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [key]);
  return rows.length ? rows[0].setting_value : null;
}
async function writeSetting(key, value) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(value)]
  );
}
async function deleteSetting(key) {
  await ensureSchema();
  await pool.execute("DELETE FROM storefront_settings WHERE setting_key=?", [key]);
}
async function readCuration(key) {
  const value = await readSetting(key);
  if (value === null) return null;
  try { return validateCuratedFavourites(JSON.parse(value)); } catch { return EMPTY_CURATION; }
}
function curationKey(kind, collection) {
  return collectionKey("curated_favourites_" + kind, collection);
}
function scheduleKey(collection) {
  return collectionKey("curated_favourites_schedule", collection);
}
async function readSchedule(collection) {
  const value = await readSetting(scheduleKey(collection));
  if (value === null) return null;
  try {
    const parsed = normalizeEditorialSchedule(JSON.parse(value));
    if (!parsed) return null;
    return {
      ...parsed,
      content: validateCuratedFavourites(parsed.content),
      previousPublished: validateCuratedFavourites(parsed.previousPublished)
    };
  } catch { return null; }
}
async function writeSchedule(collection, schedule) {
  if (schedule) await writeSetting(scheduleKey(collection), schedule);
  else await deleteSetting(scheduleKey(collection));
}
async function readCurationRecord(collection) {
  const [ownDraft, ownPublished, ownSchedule] = await Promise.all([
    readCuration(curationKey("draft", collection)),
    readCuration(curationKey("published", collection)),
    readSchedule(collection)
  ]);
  let inheritedFrom = null;
  let draft = ownDraft;
  let published = ownPublished;
  let schedule = ownSchedule;
  let scheduleCollection = collection;
  if (collection) {
    const [sharedDraft, sharedPublished, sharedSchedule] = await Promise.all([
      readCuration(curationKey("draft", null)),
      readCuration(curationKey("published", null)),
      readSchedule(null)
    ]);
    if (!draft) {
      draft = ownPublished || sharedDraft || EMPTY_CURATION;
      if (!ownPublished) inheritedFrom = "shared";
    }
    if (!published) { published = sharedPublished || EMPTY_CURATION; inheritedFrom = "shared"; }
    if (!ownSchedule && !ownPublished && sharedSchedule && getEditorialScheduleStatus(sharedSchedule) !== "expired") {
      schedule = sharedSchedule;
      scheduleCollection = null;
      inheritedFrom = "shared";
    }
  }
  return {
    draft: draft || EMPTY_CURATION,
    published: published || EMPTY_CURATION,
    schedule,
    scheduleCollection: schedule ? (scheduleCollection || "shared") : null,
    inheritedFrom
  };
}
function mapCurationRecord(record, collection) {
  return {
    draft: record.draft,
    published: record.published,
    schedule: record.schedule ? { startsAtUtc: record.schedule.startsAtUtc, endsAtUtc: record.schedule.endsAtUtc } : null,
    scheduleStatus: getEditorialScheduleStatus(record.schedule),
    scheduleCollection: record.schedule ? record.scheduleCollection : null,
    inheritedFrom: record.inheritedFrom,
    maxProducts: MAX_CURATED_PRODUCTS,
    collection: collection || "shared"
  };
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
    const collection = collectionFrom(req.query.productCollection);
    const record = await readCurationRecord(collection);
    res.set("Cache-Control", "no-store").json(mapCurationRecord(record, collection));
  } catch (error) { next(error); }
});

adminOnly.put("/draft", async (req, res, next) => {
  try {
    const draft = validateCuratedFavourites(req.body);
    const collection = collectionFrom(req.body?.productCollection);
    const collectionError = await validateCollectionProductIds(draft.productIds, collection);
    if (collectionError) return res.status(400).json({ error: collectionError });
    await writeSetting(curationKey("draft", collection), draft);
    res.set("Cache-Control", "no-store").json({ success: true, draft });
  } catch (error) {
    if (error instanceof Error && /curated|product|choose|valid|added/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

adminOnly.post("/schedule", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const record = await readCurationRecord(collection);
    if (collection && record.schedule && record.scheduleCollection === "shared") {
      return res.status(409).json({ error: "A Shared Curated Favourites schedule applies to both collections. Manage it from the Shared version first." });
    }
    const collectionError = await validateCollectionProductIds(record.draft.productIds, collection);
    if (collectionError) return res.status(400).json({ error: collectionError });
    const schedule = createEditorialSchedule(req.body || {}, record.draft, record.published);
    await writeSchedule(collection, schedule);
    const nextRecord = { ...record, schedule, scheduleCollection: collection || "shared" };
    res.set("Cache-Control", "no-store").json({ ...mapCurationRecord(nextRecord, collection), success: true });
  } catch (error) {
    if (error instanceof Error && /date|time|future|expiry|end/i.test(error.message)) return res.status(400).json({ error: error.message });
    next(error);
  }
});

adminOnly.post("/schedule/cancel", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const record = await readCurationRecord(collection);
    const owner = record.scheduleCollection === "shared" ? null : record.scheduleCollection;
    await writeSchedule(owner, null);
    const nextRecord = await readCurationRecord(collection);
    res.set("Cache-Control", "no-store").json({ ...mapCurationRecord(nextRecord, collection), success: true });
  } catch (error) { next(error); }
});

adminOnly.post("/publish", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const record = await readCurationRecord(collection);
    if (collection && record.schedule && record.scheduleCollection === "shared") {
      return res.status(409).json({ error: "A Shared Curated Favourites schedule is active for both collections. Clear it from Shared before publishing a collection-specific version." });
    }
    const draft = record.draft;
    const collectionError = await validateCollectionProductIds(draft.productIds, collection);
    if (collectionError) return res.status(400).json({ error: collectionError });
    await writeSetting(curationKey("published", collection), draft);
    await writeSchedule(collection, null);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft, schedule: null, scheduleStatus: "none" });
  } catch (error) { next(error); }
});

publicRouter.get("/", async (req, res, next) => {
  try {
    await ensureProductCollectionSchema();
    const productCollection = collectionFrom(req.query.productCollection);
    const record = await readCurationRecord(productCollection);
    const curation = getEffectiveEditorial(record);
    if (!curation.productIds.length) {
      res.set("Cache-Control", "no-store").json({ products: [], configured: curation.configured === true });
      return;
    }
    const placeholders = curation.productIds.map(() => "?").join(",");
    const collectionCondition = productCollection ? " AND product_collection = ?" : "";
    const [rows] = await pool.execute(
      `SELECT * FROM products WHERE id IN (${placeholders}) AND status='active' AND stock > 0${collectionCondition}`,
      productCollection ? [...curation.productIds, productCollection] : curation.productIds
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
