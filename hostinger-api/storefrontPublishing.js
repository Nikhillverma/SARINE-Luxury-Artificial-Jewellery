import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const admin = Router();
const publicRouter = Router();
const adminOnly = Router();
adminOnly.use(requireAdminAuth);

const DEFAULT_GENDER = { version: 1, forHerImageUrl: "", forHimImageUrl: "" };
const DEFAULT_OCCASIONS = [];
const DEFAULT_CATEGORY_IMAGES = {};
const DEFAULT_ANNOUNCEMENT = {
  message: "",
  active: false,
  trustMessages: ["Free Shipping Above ₹1,999", "7-Day Easy Returns", "Trusted by 1L+ Happy Customers"]
};

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

function collectionFrom(value) {
  const collection = String(value || "").trim().toLowerCase();
  if (!collection) return null;
  if (collection !== "artificial" && collection !== "demi-fine") {
    throw new Error("Product collection must be artificial or demi-fine.");
  }
  return collection;
}
function settingKey(workspace, version, collection) {
  return "sf_" + workspace + "_" + version + "_" + (collection || "shared");
}
async function readLegacy(key, fallback) {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [key]);
  if (!rows.length) return fallback;
  try { return JSON.parse(rows[0].setting_value); } catch { return fallback; }
}
async function writeSetting(key, value) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(value)]
  );
}
async function readRecord(workspace, collection, legacyKey, fallback) {
  const ownDraft = await readLegacy(settingKey(workspace, "draft", collection), null);
  const ownPublished = await readLegacy(settingKey(workspace, "published", collection), null);
  if (collection) {
    const shared = await readRecord(workspace, null, legacyKey, fallback);
    return {
      draft: ownDraft ?? shared.draft,
      published: ownPublished ?? shared.published,
      inheritedDraft: !ownDraft,
      inheritedPublished: !ownPublished
    };
  }
  const legacy = await readLegacy(legacyKey, fallback);
  return {
    draft: ownDraft ?? legacy,
    published: ownPublished ?? legacy,
    inheritedDraft: false,
    inheritedPublished: false
  };
}
async function saveDraft(workspace, collection, value) {
  await writeSetting(settingKey(workspace, "draft", collection), value);
}
async function publishDraft(workspace, collection, fallback) {
  const record = await readRecord(workspace, collection, null, fallback);
  await writeSetting(settingKey(workspace, "published", collection), record.draft);
  return record.draft;
}

function validateGender(input) {
  const value = {
    version: 1,
    forHerImageUrl: String(input?.forHerImageUrl || "").trim(),
    forHimImageUrl: String(input?.forHimImageUrl || "").trim()
  };
  for (const url of [value.forHerImageUrl, value.forHimImageUrl]) {
    if (url && (!/^https:\/\//i.test(url) || url.length > 2048)) throw new Error("Provide valid HTTPS Hostinger image URLs for each tile.");
  }
  return value;
}
function validateOccasions(input) {
  if (!Array.isArray(input) || input.length > 12) throw new Error("Choose up to 12 occasion cards.");
  const ids = new Set();
  return input.map((item, index) => {
    const id = String(item?.id || "").trim().slice(0, 60);
    const title = String(item?.title || "").trim();
    const subtitle = String(item?.subtitle || "").trim();
    const image = String(item?.image || "").trim();
    const link = String(item?.link || "").trim();
    if (!id || ids.has(id)) throw new Error("Each occasion must have a unique ID.");
    ids.add(id);
    if (title.length > 80 || subtitle.length > 180 || image.length > 2048 || link.length > 500) throw new Error("Occasion card text or URL exceeds the allowed length.");
    if (item?.active === true && (!title || !subtitle || !image || /product-placeholder/i.test(image))) throw new Error("Complete the title, description and image for every visible occasion card.");
    if (!(link.startsWith("/") && !link.startsWith("//")) && !/^https:\/\//i.test(link)) throw new Error("Occasion destinations must be internal paths or HTTPS URLs.");
    return { id, title, subtitle, image, link, active: item?.active === true, sortOrder: index };
  });
}
function validateCategoryImages(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Provide valid category image settings.");
  const entries = Object.entries(input);
  if (entries.length > 100) throw new Error("Too many category image overrides.");
  const result = {};
  for (const [slug, raw] of entries) {
    const url = String(raw || "").trim();
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/i.test(slug)) throw new Error("A category image key is invalid.");
    if (url.length > 2048 || (url && !((url.startsWith("/") && !url.startsWith("//")) || /^https:\/\//i.test(url)))) throw new Error("Category images must use a site path or HTTPS URL.");
    if (url) result[slug] = url;
  }
  return result;
}
function validateAnnouncement(input) {
  const message = String(input?.message || "").trim();
  const trustMessages = Array.isArray(input?.trustMessages) ? input.trustMessages.slice(0, 3).map(item => String(item || "").trim()) : [];
  if (message.length > 300) throw new Error("Announcement must be 300 characters or fewer.");
  if (trustMessages.length > 3 || trustMessages.some(item => item.length > 100)) throw new Error("Each trust message must be 100 characters or fewer.");
  return { message, active: input?.active === true, trustMessages };
}

function attachWorkspaceRoutes({ path, workspace, legacyKey, fallback, validate, inputField, publicShape, defaultPublic }) {
  adminOnly.get(path, async (req, res, next) => {
    try {
      const collection = collectionFrom(req.query.productCollection);
      const record = await readRecord(workspace, collection, legacyKey, fallback);
      res.set("Cache-Control", "no-store").json({
        draft: record.draft,
        published: record.published,
        inheritedDraft: record.inheritedDraft,
        inheritedPublished: record.inheritedPublished,
        collection: collection || "shared"
      });
    } catch (error) {
      if (/product collection/i.test(error.message)) return res.status(400).json({ error: error.message });
      next(error);
    }
  });
  adminOnly.put(path + "/draft", async (req, res, next) => {
    try {
      const collection = collectionFrom(req.body?.productCollection);
      const value = validate(req.body?.[inputField]);
      await saveDraft(workspace, collection, value);
      const record = await readRecord(workspace, collection, legacyKey, fallback);
      res.set("Cache-Control", "no-store").json({ success: true, draft: value, published: record.published });
    } catch (error) {
      if (/product collection/i.test(error.message) || error instanceof Error) return res.status(400).json({ error: error.message });
      next(error);
    }
  });
  adminOnly.post(path + "/publish", async (req, res, next) => {
    try {
      const collection = collectionFrom(req.body?.productCollection);
      const record = await readRecord(workspace, collection, legacyKey, fallback);
      await writeSetting(settingKey(workspace, "published", collection), record.draft);
      res.set("Cache-Control", "no-store").json({ success: true, published: record.draft, collection: collection || "shared" });
    } catch (error) {
      if (/product collection/i.test(error.message)) return res.status(400).json({ error: error.message });
      next(error);
    }
  });
  publicRouter.get(path, async (req, res, next) => {
    try {
      const collection = collectionFrom(req.query.productCollection);
      const record = await readRecord(workspace, collection, legacyKey, fallback);
      const value = record.published;
      res.set("Cache-Control", "no-store").json(publicShape(value, defaultPublic));
    } catch (error) {
      if (/product collection/i.test(error.message)) return res.status(400).json({ error: error.message });
      next(error);
    }
  });
}

attachWorkspaceRoutes({
  path: "/shop-by-gender",
  workspace: "gender",
  legacyKey: "shop_by_gender",
  fallback: DEFAULT_GENDER,
  validate: validateGender,
  inputField: "settings",
  publicShape: value => ({ settings: value }),
  defaultPublic: { settings: DEFAULT_GENDER }
});
attachWorkspaceRoutes({
  path: "/occasions",
  workspace: "occasions",
  legacyKey: "shop_by_occasion",
  fallback: DEFAULT_OCCASIONS,
  validate: validateOccasions,
  inputField: "occasions",
  publicShape: value => ({ occasions: value }),
  defaultPublic: { occasions: DEFAULT_OCCASIONS }
});
attachWorkspaceRoutes({
  path: "/category-images",
  workspace: "category-images",
  legacyKey: "homepage_category_images",
  fallback: DEFAULT_CATEGORY_IMAGES,
  validate: validateCategoryImages,
  inputField: "images",
  publicShape: value => ({ images: value }),
  defaultPublic: { images: DEFAULT_CATEGORY_IMAGES }
});
attachWorkspaceRoutes({
  path: "/announcement",
  workspace: "announcement",
  legacyKey: "announcement",
  fallback: DEFAULT_ANNOUNCEMENT,
  validate: validateAnnouncement,
  inputField: "announcement",
  publicShape: value => ({ announcement: value }),
  defaultPublic: { announcement: { message: "", active: false, trustMessages: [] } }
});

admin.use("/", adminOnly);
export { publicRouter as publicStorefrontPublishingRouter };
export default admin;
