import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import rateLimit from "express-rate-limit";
import { validateImageUpload } from "./mediaValidation.js";
import { getCheckoutConfig, saveCheckoutConfig } from "./checkoutPolicy.js";
import { buildAnnouncementSettings, normalizeAnnouncementSettings } from "./announcementPolicy.js";
import { ensureProductCollectionSchema } from "./productCollectionSchema.js";

const admin = Router();
const publicRouter = Router();
const adminOnly = Router();
adminOnly.use(requireAdminAuth);

let schemaReady;
async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.execute(`CREATE TABLE IF NOT EXISTS storefront_banners (
        id CHAR(36) NOT NULL PRIMARY KEY,
        tagline VARCHAR(120) NOT NULL DEFAULT '',
        title VARCHAR(180) NOT NULL,
        subtitle VARCHAR(500) NOT NULL DEFAULT '',
        cta_text VARCHAR(80) NOT NULL DEFAULT 'Shop now',
        cta_link VARCHAR(500) NOT NULL DEFAULT '/shop',
        image_url VARCHAR(2048) NOT NULL,
        product_collection VARCHAR(24) NULL,
        starts_at_utc VARCHAR(24) NULL,
        ends_at_utc VARCHAR(24) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_storefront_banners_active_order (is_active, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      const [bannerColumns] = await pool.execute("SHOW COLUMNS FROM storefront_banners LIKE 'product_collection'");
      if (!bannerColumns.length) await pool.execute("ALTER TABLE storefront_banners ADD COLUMN product_collection VARCHAR(24) NULL AFTER image_url");
      const [startColumn] = await pool.execute("SHOW COLUMNS FROM storefront_banners LIKE 'starts_at_utc'");
      if (!startColumn.length) await pool.execute("ALTER TABLE storefront_banners ADD COLUMN starts_at_utc VARCHAR(24) NULL AFTER product_collection");
      const [endColumn] = await pool.execute("SHOW COLUMNS FROM storefront_banners LIKE 'ends_at_utc'");
      if (!endColumn.length) await pool.execute("ALTER TABLE storefront_banners ADD COLUMN ends_at_utc VARCHAR(24) NULL AFTER starts_at_utc");
      const [bannerIndexes] = await pool.execute("SHOW INDEX FROM storefront_banners WHERE Key_name='idx_storefront_banners_collection_active'");
      if (!bannerIndexes.length) await pool.execute("ALTER TABLE storefront_banners ADD INDEX idx_storefront_banners_collection_active (product_collection, is_active, sort_order)");
      await pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch(error => { schemaReady = undefined; throw error; });
  }
  await schemaReady;
}

function collectionFrom(value) { const v = String(value || "").trim().toLowerCase(); if (!v) return null; if (v !== "artificial" && v !== "demi-fine") throw new Error("Product collection must be artificial or demi-fine."); return v; }
function settingKey(base, collection) { return collection ? base + "_" + collection : base; }
function mapBanner(row) {
  return {
    id: row.id, tagline: row.tagline, title: row.title, subtitle: row.subtitle,
    ctaText: row.cta_text, ctaLink: row.cta_link, imageUrl: row.image_url,
    active: Boolean(row.is_active), sortOrder: Number(row.sort_order), productCollection: row.product_collection || null, startsAtUtc: row.starts_at_utc || null, endsAtUtc: row.ends_at_utc || null
  };
}
function normalizeBannerSchedule(value, label) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(label + " must be a valid UTC timestamp.");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error(label + " must be a valid UTC timestamp.");
  return value;
}
function validate(input) {
  const title = String(input.title || "").trim();
  const imageUrl = String(input.imageUrl || "").trim();
  const ctaLink = String(input.ctaLink || "/shop").trim();
  if (!title || title.length > 180) return "Banner title is required (maximum 180 characters).";
  if (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 2048) return "Banner image must be a valid HTTPS media URL.";
  if (!(ctaLink.startsWith("/") && !ctaLink.startsWith("//")) && !/^https:\/\//i.test(ctaLink)) return "CTA destination must be a site path or HTTPS URL.";
  if (ctaLink.length > 500) return "CTA destination is too long.";
  try {
    const start = normalizeBannerSchedule(input.startsAtUtc, "Start date");
    const end = normalizeBannerSchedule(input.endsAtUtc, "End date");
    if (start && end && end <= start) return "End date must be later than the start date.";
  } catch (error) { return error.message; }
  return null;
}

async function readHomepageCategoryImages(collection = null) {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [settingKey("homepage_category_images", collection)]);
  if (!rows.length) return {};
  try {
    const value = JSON.parse(rows[0].setting_value);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([slug, url]) =>
      /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) && typeof url === "string" &&
      url.length <= 2048 && (url === "" || url.startsWith("/") && !url.startsWith("//") || /^https:\/\//i.test(url))
    ));
  } catch { return {}; }
}
adminOnly.get("/category-images", async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ images: await readHomepageCategoryImages(collectionFrom(req.query.productCollection)) }); }
  catch (error) { next(error); }
});
adminOnly.put("/category-images", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const input = req.body?.images;
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length > 50) return res.status(400).json({ error: "Provide a valid category image map." });
    const images = {};
    for (const [slug, rawUrl] of Object.entries(input)) {
      const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || url.length > 2048 || (url && !(url.startsWith("/") && !url.startsWith("//")) && !/^https:\/\//i.test(url))) return res.status(400).json({ error: "Each category image must use a valid category slug and site or HTTPS image URL." });
      if (url) images[slug] = url;
    }
    await ensureSchema();
    await pool.execute("INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [settingKey("homepage_category_images", collection), JSON.stringify(images)]);
    res.set("Cache-Control", "no-store").json({ success: true, images });
  } catch (error) { next(error); }
});
publicRouter.get("/category-images", async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ images: await readHomepageCategoryImages(collectionFrom(req.query.productCollection)) }); }
  catch (error) { next(error); }
});

adminOnly.get("/banners", async (req, res, next) => {
  try {
    await ensureSchema();
    const collection = collectionFrom(req.query.productCollection);
    const [rows] = collection ? await pool.execute("SELECT * FROM storefront_banners WHERE product_collection=? ORDER BY sort_order ASC, created_at ASC", [collection]) : await pool.execute("SELECT * FROM storefront_banners WHERE product_collection IS NULL ORDER BY sort_order ASC, created_at ASC");
    res.set("Cache-Control", "no-store").json({ banners: rows.map(mapBanner) });
  } catch (error) { next(error); }
});
adminOnly.post("/banners", async (req, res, next) => {
  try {
    await ensureSchema();
    const input = req.body || {};
    const invalid = validate(input);
    if (invalid) return res.status(400).json({ error: invalid });
    let productCollection;
    try { productCollection = collectionFrom(input.productCollection); } catch (error) { return res.status(400).json({ error: error.message }); }
    const id = crypto.randomUUID();
    const [count] = await pool.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM storefront_banners WHERE product_collection <=> ?", [productCollection]);
    await pool.execute(
      `INSERT INTO storefront_banners
       (id, tagline, title, subtitle, cta_text, cta_link, image_url, product_collection, starts_at_utc, ends_at_utc, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(input.tagline || "").slice(0,120), String(input.title).trim(),
       String(input.subtitle || "").slice(0,500), String(input.ctaText || "Shop now").slice(0,80),
       String(input.ctaLink || "/shop").trim(), String(input.imageUrl).trim(), productCollection,
       normalizeBannerSchedule(input.startsAtUtc, "Start date"), normalizeBannerSchedule(input.endsAtUtc, "End date"),
       input.active === true ? 1 : 0, Number.isInteger(input.sortOrder) ? input.sortOrder : Number(count[0].next_order)]
    );
    const [rows] = await pool.execute("SELECT * FROM storefront_banners WHERE id = ?", [id]);
    res.status(201).json({ banner: mapBanner(rows[0]) });
  } catch (error) { next(error); }
});
adminOnly.put("/banners/:id", async (req, res, next) => {
  try {
    await ensureSchema();
    const input = req.body || {};
    const [existing] = await pool.execute("SELECT * FROM storefront_banners WHERE id = ? LIMIT 1", [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: "Banner not found." });
    const current = mapBanner(existing[0]);
    const merged = { ...current, ...input };
    let productCollection;
    try { productCollection = collectionFrom(merged.productCollection); } catch (error) { return res.status(400).json({ error: error.message }); }
    const invalid = validate(merged);
    if (invalid) return res.status(400).json({ error: invalid });
    await pool.execute(
      `UPDATE storefront_banners SET tagline=?, title=?, subtitle=?, cta_text=?, cta_link=?,
       image_url=?, product_collection=?, starts_at_utc=?, ends_at_utc=?, is_active=?, sort_order=? WHERE id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
      [String(merged.tagline || "").slice(0,120), String(merged.title).trim(),
       String(merged.subtitle || "").slice(0,500), String(merged.ctaText || "Shop now").slice(0,80),
       String(merged.ctaLink || "/shop").trim(), String(merged.imageUrl).trim(), productCollection,
       normalizeBannerSchedule(merged.startsAtUtc, "Start date"), normalizeBannerSchedule(merged.endsAtUtc, "End date"),
       merged.active === true ? 1 : 0,
       Number.isInteger(merged.sortOrder) ? merged.sortOrder : current.sortOrder, req.params.id]
    );
    const [rows] = await pool.execute("SELECT * FROM storefront_banners WHERE id = ?", [req.params.id]);
    res.json({ banner: mapBanner(rows[0]) });
  } catch (error) { next(error); }
});
adminOnly.delete("/banners/:id", async (req, res, next) => {
  try {
    await ensureSchema();
    const [result] = await pool.execute("DELETE FROM storefront_banners WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Banner not found." });
    res.json({ success: true });
  } catch (error) { next(error); }
});
adminOnly.put("/banners/reorder", async (req, res, next) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length > 30 || ids.some(id => typeof id !== "string")) return res.status(400).json({ error: "Provide a valid ordered list of banner IDs." });
  let connection;
  try {
    const collection = collectionFrom(req.body?.productCollection);
    await ensureSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await connection.execute("UPDATE storefront_banners SET sort_order=? WHERE id=? AND product_collection <=> ?", [i, ids[i], collection]);
    }
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
});
adminOnly.put("/announcement", async (req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    let announcement;
    try {
      announcement = buildAnnouncementSettings(req.body || {}, rows[0]?.setting_value);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "Announcement settings are invalid." });
    }
    await pool.execute(
      "INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('announcement', ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
      [JSON.stringify(announcement)]
    );
    res.json({ success: true, announcement });
  } catch (error) { next(error); }
});
adminOnly.get("/announcement", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    const announcement = normalizeAnnouncementSettings(rows[0]?.setting_value);
    res.set("Cache-Control", "no-store").json({ announcement });
  } catch (error) { next(error); }
});



// Shop by Gender imagery is managed independently in Storefront Studio and stored in MariaDB.
const DEFAULT_SHOP_BY_GENDER = Object.freeze({ version: 1, forHerImageUrl: "", forHimImageUrl: "" });
function validateShopByGender(input) {
  if (!input || typeof input !== "object" || input.version !== 1) throw new Error("Shop by Gender settings version is invalid.");
  const imageUrl = (value, label) => {
    const url = typeof value === "string" ? value.trim() : "";
    if (url.length > 2048 || (url && !/^https:\/\//i.test(url))) throw new Error(label + " must be a valid HTTPS image URL.");
    return url;
  };
  return {
    version: 1,
    forHerImageUrl: imageUrl(input.forHerImageUrl, "For Her image"),
    forHimImageUrl: imageUrl(input.forHimImageUrl, "For Him image")
  };
}
async function readShopByGender(collection = null) {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [settingKey("shop_by_gender", collection)]);
  if (!rows.length) return DEFAULT_SHOP_BY_GENDER;
  try { return validateShopByGender(JSON.parse(rows[0].setting_value)); }
  catch { return DEFAULT_SHOP_BY_GENDER; }
}
adminOnly.get("/shop-by-gender", async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ settings: await readShopByGender(collectionFrom(req.query.productCollection)) }); }
  catch (error) { next(error); }
});
adminOnly.put("/shop-by-gender", async (req, res, next) => {
  try {
    let settings;
    try { settings = validateShopByGender(req.body || {}); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    await ensureSchema();
    await pool.execute(
      "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
      [settingKey("shop_by_gender", collectionFrom(req.body?.productCollection)), JSON.stringify(settings)]
    );
    res.set("Cache-Control", "no-store").json({ success: true, settings });
  } catch (error) { next(error); }
});
publicRouter.get("/shop-by-gender", async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ settings: await readShopByGender(collectionFrom(req.query.productCollection)) }); }
  catch (error) { next(error); }
});

// Shop by Occasion cards are editable in Storefront Studio and stored in MariaDB.
const defaultOccasions = [
  { id: "daily-wear", title: "Daily Wear", subtitle: "Effortless everyday minimalism", image: "/images/ananya-temple-coin-bracelet.jpg", link: "/shop?search=everyday", active: true, sortOrder: 0 },
  { id: "festive", title: "Festive", subtitle: "Celebratory sparkle and classic motifs", image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1000&q=80", link: "/shop?search=festive", active: true, sortOrder: 1 },
  { id: "wedding", title: "Wedding", subtitle: "Regal bridal sets & heritage chokers", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1000&q=80", link: "/shop?search=wedding", active: true, sortOrder: 2 },
  { id: "gifting", title: "Gifting", subtitle: "Precious tokens of affection", image: "/images/zoya-open-cuff-leaf-bangle.jpg", link: "/shop", active: true, sortOrder: 3 }
];
function validateOccasions(input) {
  if (!Array.isArray(input) || input.length > 12) throw new Error("Add up to 12 occasion cards.");
  const ids = new Set();
  return input.map((item, index) => {
    const id = String(item?.id || "").trim();
    const title = String(item?.title || "").trim();
    const subtitle = String(item?.subtitle || "").trim();
    const image = String(item?.image || "").trim();
    const link = String(item?.link || "").trim();
    if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(id) || ids.has(id)) throw new Error("Each occasion needs a unique, valid ID.");
    ids.add(id);
    if (!title || title.length > 80 || subtitle.length > 180) throw new Error("Enter an occasion title (maximum 80 characters) and description (maximum 180).");
    if (!image || image.length > 2048 || (!image.startsWith("/") && !/^https:\/\//i.test(image))) throw new Error("Choose a valid site image path or HTTPS image URL.");
    if (!link || link.length > 500 || !(link.startsWith("/") && !link.startsWith("//"))) throw new Error("Occasion links must be internal SARINE site paths.");
    return { id, title, subtitle, image, link, active: item.active === true, sortOrder: index };
  });
}
async function readOccasions(collection = null) {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [settingKey("shop_by_occasion", collection)]);
  if (!rows.length) return defaultOccasions;
  try { return validateOccasions(JSON.parse(rows[0].setting_value)); } catch { return defaultOccasions; }
}
adminOnly.get("/occasions", async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ occasions: await readOccasions(collectionFrom(req.query.productCollection)) }); }
  catch (error) { next(error); }
});
adminOnly.put("/occasions", async (req, res, next) => {
  try {
    let occasions;
    try { occasions = validateOccasions(req.body?.occasions); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    await ensureSchema();
    await pool.execute("INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [settingKey("shop_by_occasion", collectionFrom(req.body?.productCollection)), JSON.stringify(occasions)]);
    res.set("Cache-Control", "no-store").json({ success: true, occasions });
  } catch (error) { next(error); }
});
publicRouter.get("/occasions", async (req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ occasions: (await readOccasions(collectionFrom(req.query.productCollection))).filter(item => item.active).sort((a,b) => a.sortOrder-b.sortOrder) }); }
  catch (error) { next(error); }
});

publicRouter.get("/banners", async (req, res, next) => {
  try {
    await ensureSchema();
    const collection = collectionFrom(req.query.productCollection);
    const nowUtc = new Date().toISOString();
    const [rows] = collection
      ? await pool.execute(
        "SELECT * FROM storefront_banners WHERE is_active=1 AND (product_collection IS NULL OR product_collection=?) AND (starts_at_utc IS NULL OR starts_at_utc<=?) AND (ends_at_utc IS NULL OR ends_at_utc>?) ORDER BY sort_order ASC, created_at ASC",
        [collection, nowUtc, nowUtc]
      )
      : await pool.execute(
        "SELECT * FROM storefront_banners WHERE product_collection IS NULL AND is_active=1 AND (starts_at_utc IS NULL OR starts_at_utc<=?) AND (ends_at_utc IS NULL OR ends_at_utc>?) ORDER BY sort_order ASC, created_at ASC",
        [nowUtc, nowUtc]
      );
    res.set("Cache-Control", "no-store").json({ banners: rows.map(mapBanner) });
  } catch (error) { next(error); }
});
adminOnly.get("/checkout-config", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json({ checkoutConfig: { ...await getCheckoutConfig(), razorpayMode: String(process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_") ? "test" : "live" } });
  } catch (error) { next(error); }
});
adminOnly.put("/checkout-config", async (req, res, next) => {
  try {
    const checkoutConfig = await saveCheckoutConfig(req.body || {});
    res.set("Cache-Control", "no-store").json({ success: true, checkoutConfig });
  } catch (error) {
    if (error instanceof Error && /must be|choose whether/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});
publicRouter.get("/checkout-config", async (_req, res, next) => {
  try {
    const razorpayMode = String(process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_") ? "test" : "live";
    res.set("Cache-Control", "no-store").json({ checkoutConfig: { ...await getCheckoutConfig(), razorpayMode } });
  } catch (error) { next(error); }
});

publicRouter.get("/announcement", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    const announcement = normalizeAnnouncementSettings(rows[0]?.setting_value);
    res.set("Cache-Control", "no-store").json({ announcement });
  } catch (error) { next(error); }
});


const campaignDefaults = [];
function normalizeCampaigns(value) {
  let parsed = [];
  try { parsed = typeof value === "string" ? JSON.parse(value) : value; } catch {}
  if (!Array.isArray(parsed)) return campaignDefaults;
  return parsed.filter(item => item && typeof item.id === "string").slice(0, 30).map(item => ({
    id: item.id,
    name: String(item.name || "").slice(0, 100),
    festival: String(item.festival || "Other").slice(0, 60),
    campaignType: item.campaignType === "sale" ? "sale" : "festival",
    eyebrow: String(item.eyebrow || "").slice(0, 100),
    title: String(item.title || "").slice(0, 180),
    subtitle: String(item.subtitle || "").slice(0, 400),
    imageUrl: String(item.imageUrl || "").slice(0, 2048),
    ctaText: String(item.ctaText || "Shop now").slice(0, 80),
    ctaLink: String(item.ctaLink || "/shop").slice(0, 500),
    couponCode: String(item.couponCode || "").toUpperCase().slice(0, 40),
    offerLabel: String(item.offerLabel || "").slice(0, 80),
    startsAt: item.startsAt || null,
    endsAt: item.endsAt || null,
    active: item.active === true,
    showCountdown: item.showCountdown === true,
    artworkOnly: item.artworkOnly !== false,
    storewideDiscountPercent: Math.max(0, Math.min(75, Math.floor(Number(item.storewideDiscountPercent) || 0))),
    sortOrder: Math.max(0, Math.min(99, Math.floor(Number(item.sortOrder) || 0))),
    heroPlacement: ["first", "normal"].includes(item.heroPlacement) ? item.heroPlacement : "auto",
    heroDurationSeconds: Math.max(5, Math.min(20, Math.floor(Number(item.heroDurationSeconds) || 9))),
    countdownLabel: String(item.countdownLabel || "").trim().slice(0, 70),
    countdownBackgroundColor: /^#[0-9a-f]{6}$/i.test(String(item.countdownBackgroundColor || "")) ? String(item.countdownBackgroundColor) : "#563568",
    countdownTextColor: /^#[0-9a-f]{6}$/i.test(String(item.countdownTextColor || "")) ? String(item.countdownTextColor) : "#FFFFFF",
    countdownTimerColor: /^#[0-9a-f]{6}$/i.test(String(item.countdownTimerColor || "")) ? String(item.countdownTimerColor) : "#FFE08A",
    updatedAt: item.updatedAt || null
  }));
}
async function readCampaigns() {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='festival_campaigns' LIMIT 1");
  return normalizeCampaigns(rows[0]?.setting_value);
}
function isCampaignLive(item, now = Date.now()) {
  const starts = item.startsAt ? new Date(item.startsAt).getTime() : 0;
  const ends = item.endsAt ? new Date(item.endsAt).getTime() : Number.POSITIVE_INFINITY;
  return item.active && Number.isFinite(starts) && (ends === Number.POSITIVE_INFINITY || Number.isFinite(ends)) && starts <= now && ends > now;
}
function getLiveCampaigns(campaigns, now = Date.now()) {
  return campaigns.filter(item => isCampaignLive(item, now))
    .sort((a, b) => a.sortOrder - b.sortOrder || new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}
adminOnly.get("/campaigns", async (_req, res, next) => {
  try { res.set("Cache-Control", "no-store").json({ campaigns: await readCampaigns() }); }
  catch (error) { next(error); }
});
adminOnly.put("/campaigns", async (req, res, next) => {
  try {
    const campaigns = normalizeCampaigns(req.body?.campaigns);
    if (Array.isArray(req.body?.campaigns) && req.body.campaigns.length > 30) return res.status(400).json({ error: "You can manage up to 30 campaigns." });
    for (const item of campaigns) {
      if (!item.name || !item.title || !item.festival) return res.status(400).json({ error: "Each campaign needs a name, type and headline." });
      if (!item.imageUrl || (!item.imageUrl.startsWith("/") && !/^https:\/\//i.test(item.imageUrl))) return res.status(400).json({ error: "Each campaign needs a valid site image path or HTTPS image URL." });
      if (!(item.ctaLink.startsWith("/") && !item.ctaLink.startsWith("//")) && !/^https:\/\//i.test(item.ctaLink)) return res.status(400).json({ error: "Campaign destinations must be internal paths or HTTPS URLs." });
      if (item.startsAt && !Number.isFinite(new Date(item.startsAt).getTime())) return res.status(400).json({ error: "Enter a valid campaign start date." });
      if (item.endsAt && !Number.isFinite(new Date(item.endsAt).getTime())) return res.status(400).json({ error: "Enter a valid campaign end date." });
      if (item.startsAt && item.endsAt && new Date(item.startsAt) >= new Date(item.endsAt)) return res.status(400).json({ error: "Campaign end date must be after its start date." });
      if (item.storewideDiscountPercent < 0 || item.storewideDiscountPercent > 75) return res.status(400).json({ error: "Storewide discounts must be between 1% and 75%, or 0 for no automatic discount." });
      if (item.showCountdown && !item.endsAt) return res.status(400).json({ error: "Add an end date before enabling the countdown timer." });
    }
    const discountCampaigns = campaigns.filter(item => item.active && item.storewideDiscountPercent > 0);
    for (let i = 0; i < discountCampaigns.length; i += 1) {
      for (let j = i + 1; j < discountCampaigns.length; j += 1) {
        const a = discountCampaigns[i], b = discountCampaigns[j];
        const aStart = a.startsAt ? new Date(a.startsAt).getTime() : Number.NEGATIVE_INFINITY;
        const aEnd = a.endsAt ? new Date(a.endsAt).getTime() : Number.POSITIVE_INFINITY;
        const bStart = b.startsAt ? new Date(b.startsAt).getTime() : Number.NEGATIVE_INFINITY;
        const bEnd = b.endsAt ? new Date(b.endsAt).getTime() : Number.POSITIVE_INFINITY;
        if (aStart < bEnd && bStart < aEnd) return res.status(400).json({ error: "Two enabled storewide discounts overlap. Schedule them for separate time windows to avoid stacking." });
      }
    }
    const saved = campaigns.map(item => ({ ...item, updatedAt: new Date().toISOString() }));
    await pool.execute("INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('festival_campaigns', ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [JSON.stringify(saved)]);
    res.set("Cache-Control", "no-store").json({ success: true, campaigns: saved });
  } catch (error) { next(error); }
});
publicRouter.get("/campaign", async (_req, res, next) => {
  try {
    const campaigns = getLiveCampaigns(await readCampaigns());
    res.set("Cache-Control", "no-store").json({ campaigns, campaign: campaigns[0] || null });
  } catch (error) { next(error); }
});


const DEFAULT_MEN_STOREFRONT = {
  version: 1, enabled: true, heroImageUrl: "", eyebrow: "SARINE · MEN",
  title: "A New Standard of Style",
  description: "Modern essentials. Timeless details. Discover a considered edit of jewellery for him.",
  comingSoon: true, comingSoonText: "Our men's edit is on its way. Be among the first to discover it.",
  categories: [
    { id: "bracelets", title: "Bracelets", description: "Refined details for every day.", imageUrl: "", active: true, sortOrder: 0 },
    { id: "chains", title: "Chains", description: "Understated pieces with presence.", imageUrl: "", active: true, sortOrder: 1 },
    { id: "rings", title: "Rings", description: "A signature in the details.", imageUrl: "", active: true, sortOrder: 2 },
    { id: "kada", title: "Kada", description: "Classic form, modern character.", imageUrl: "", active: true, sortOrder: 3 }
  ],
  showProducts: false, productIds: [], featuredTitle: "The Men's Edit",
  bestSellerIds: [], showBestSellers: false,
  collections: [],
  offers: { enabled: false, label: "A little something extra", description: "", ctaText: "Explore offers", ctaLink: "/men" },
  notification: { enabled: true, headline: "Be first to know", description: "Sign up for an update when SARINE Men arrives.", buttonText: "Notify me" }
};
function normalizeMenStorefront(value) {
  const input = value && typeof value === "object" ? value : {};
  const text = (v, fallback, max) => String(v ?? fallback).trim().slice(0, max);
  const safeImage = v => { const s = text(v, "", 2048); return !s || /^https:\/\//i.test(s) ? s : ""; };
  const categories = Array.isArray(input.categories) ? input.categories.slice(0, 12).map((item, index) => ({
    id: text(item?.id, "category-" + index, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    title: text(item?.title, "Category", 80),
    description: text(item?.description, "", 180),
    imageUrl: safeImage(item?.imageUrl),
    productIds: Array.isArray(item?.productIds) ? [...new Set(item.productIds.filter(id => typeof id === "string"))].slice(0, 100) : [],
    active: item?.active !== false,
    sortOrder: Number.isInteger(item?.sortOrder) ? Math.max(0, item.sortOrder) : index
  })) : DEFAULT_MEN_STOREFRONT.categories;
  const collections = Array.isArray(input.collections) ? input.collections.slice(0, 20).map((item, index) => ({
    id: text(item?.id, "collection-" + index, 60).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    title: text(item?.title, "Collection", 100),
    description: text(item?.description, "", 240),
    productIds: Array.isArray(item?.productIds) ? [...new Set(item.productIds.filter(id => typeof id === "string"))].slice(0, 50) : [],
    active: item?.active === true,
    sortOrder: index
  })) : [];
  const offers = input.offers && typeof input.offers === "object" ? input.offers : {};
  const notification = input.notification && typeof input.notification === "object" ? input.notification : {};
  const productIds = Array.isArray(input.productIds) ? [...new Set(input.productIds.filter(id => typeof id === "string"))].slice(0, 100) : [];
  const bestSellerIds = Array.isArray(input.bestSellerIds) ? [...new Set(input.bestSellerIds.filter(id => typeof id === "string"))].slice(0, 12) : [];
  const ctaLink = text(offers.ctaLink, "/men", 500);
  return {
    version: 1, enabled: input.enabled !== false, heroImageUrl: safeImage(input.heroImageUrl),
    eyebrow: text(input.eyebrow, DEFAULT_MEN_STOREFRONT.eyebrow, 100),
    title: text(input.title, DEFAULT_MEN_STOREFRONT.title, 140),
    description: text(input.description, DEFAULT_MEN_STOREFRONT.description, 500),
    comingSoon: false,
    comingSoonText: text(input.comingSoonText, DEFAULT_MEN_STOREFRONT.comingSoonText, 300),
    categories, showProducts: input.showProducts === true, productIds,
    featuredTitle: text(input.featuredTitle, DEFAULT_MEN_STOREFRONT.featuredTitle, 100),
    bestSellerIds, showBestSellers: input.showBestSellers === true,
    collections,
    offers: {
      enabled: offers.enabled === true,
      label: text(offers.label, DEFAULT_MEN_STOREFRONT.offers.label, 100),
      description: text(offers.description, "", 300),
      ctaText: text(offers.ctaText, "Explore offers", 80),
      ctaLink: ctaLink.startsWith("/") && !ctaLink.startsWith("//") ? ctaLink : "/men"
    },
    notification: {
      enabled: notification.enabled !== false,
      headline: text(notification.headline, DEFAULT_MEN_STOREFRONT.notification.headline, 100),
      description: text(notification.description, DEFAULT_MEN_STOREFRONT.notification.description, 240),
      buttonText: text(notification.buttonText, "Notify me", 40)
    }
  };
}
async function readMenStorefrontRecord(collection = null) {
  await ensureSchema();
  const key = settingKey("men_storefront", collection);
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [key]);
  // Collection-specific versions inherit Shared until that collection has its own saved record.
  let sourceRows = rows;
  if (!sourceRows.length && collection) {
    const sharedKey = settingKey("men_storefront", null);
    const [sharedRows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [sharedKey]);
    sourceRows = sharedRows;
  }
  if (!sourceRows.length) return { draft: DEFAULT_MEN_STOREFRONT, published: DEFAULT_MEN_STOREFRONT };
  try {
    const saved = JSON.parse(sourceRows[0].setting_value);
    return { draft: normalizeMenStorefront(saved.draft), published: normalizeMenStorefront(saved.published) };
  } catch { return { draft: DEFAULT_MEN_STOREFRONT, published: DEFAULT_MEN_STOREFRONT }; }
}
async function writeMenStorefrontRecord(record, collection = null) {
  await pool.execute("INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [settingKey("men_storefront", collection), JSON.stringify(record)]);
}
async function ensureMenSubscribersSchema() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS men_launch_subscribers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    consent TINYINT(1) NOT NULL DEFAULT 0,
    source VARCHAR(40) NOT NULL DEFAULT 'men-page',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_men_launch_email (email),
    INDEX idx_men_launch_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
const menSignupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many signup attempts. Please try again later." } });
adminOnly.get("/men-storefront", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.query.productCollection);
    const record = await readMenStorefrontRecord(collection);
    await ensureProductCollectionSchema();
    const collectionFilter = collection ? " AND product_collection = ?" : "";
    const productParams = collection ? ["__sarine_men_catalogue__", collection] : ["__sarine_men_catalogue__"];
    const [rows] = await pool.execute(
      `SELECT id, name, slug, price, images, status, stock, product_collection FROM products WHERE JSON_CONTAINS(COALESCE(tags, '[]'), JSON_QUOTE(?))${collectionFilter} ORDER BY created_at DESC LIMIT 500`,
      productParams
    );
    const products = rows.map(row => {
      let images = []; try { images = JSON.parse(row.images || "[]"); } catch {}
      return { id: row.id, name: row.name, slug: row.slug, price: Number(row.price), images: Array.isArray(images) ? images : [], status: row.status, stock: Number(row.stock), productCollection: row.product_collection || null };
    });
    res.set("Cache-Control", "no-store").json({ ...record, products });
  } catch (error) { next(error); }
});
adminOnly.put("/men-storefront/draft", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const draft = normalizeMenStorefront(req.body?.settings);
    if (!draft.title || !draft.description) return res.status(400).json({ error: "Add a title and description for the men's page." });
    const record = await readMenStorefrontRecord(collection);
    await writeMenStorefrontRecord({ ...record, draft }, collection);
    res.set("Cache-Control", "no-store").json({ success: true, draft });
  } catch (error) { next(error); }
});
adminOnly.post("/men-storefront/publish", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const record = await readMenStorefrontRecord(collection);
    const published = normalizeMenStorefront(record.draft);
    await writeMenStorefrontRecord({ ...record, published }, collection);
    res.set("Cache-Control", "no-store").json({ success: true, published });
  } catch (error) { next(error); }
});
publicRouter.get("/men-storefront", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.query.productCollection);
    const { published } = await readMenStorefrontRecord(collection);
    await ensureProductCollectionSchema();
    const productIds = [...new Set([
      ...(published.showProducts ? published.productIds : []),
      ...(published.showBestSellers ? published.bestSellerIds : []),
      ...published.categories.filter(item => item.active).flatMap(item => item.productIds || []),
      ...published.collections.filter(item => item.active).flatMap(item => item.productIds)
    ])];
    let products = [];
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      const collectionFilter = collection ? " AND product_collection = ?" : "";
      const productParams = collection ? [...productIds, collection] : [...productIds];
      const [rows] = await pool.execute(
        `SELECT id, name, slug, price, compare_at_price, images, stock, product_collection FROM products WHERE status='active' AND JSON_CONTAINS(COALESCE(tags, '[]'), JSON_QUOTE('__sarine_men_catalogue__')) AND id IN (${placeholders})${collectionFilter}`,
        productParams
      );
      const byId = new Map(rows.map(row => [row.id, row]));
      products = productIds.map(id => byId.get(id)).filter(Boolean).map(row => {
        let images = []; try { images = JSON.parse(row.images || "[]"); } catch {}
        return { id: row.id, name: row.name, slug: row.slug, price: Number(row.price), compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price), images: Array.isArray(images) ? images : [], stock: Number(row.stock), productCollection: row.product_collection || null };
      });
    }
    res.set("Cache-Control", "no-store").json({ settings: published, products });
  } catch (error) { next(error); }
});
publicRouter.get("/men-storefront/categories/:categoryId", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.query.productCollection);
    const { published } = await readMenStorefrontRecord(collection);
    if (!published.enabled) return res.status(404).json({ error: "Men's storefront is unavailable." });
    const category = published.categories.find(item => item.id === req.params.categoryId && item.active);
    if (!category) return res.status(404).json({ error: "Men's category not found." });
    const ids = Array.isArray(category.productIds) ? [...new Set(category.productIds)].slice(0, 100) : [];
    let products = [];
    if (ids.length) {
      await ensureProductCollectionSchema();
      const placeholders = ids.map(() => "?").join(",");
      const collectionFilter = collection ? " AND product_collection = ?" : "";
      const productParams = collection ? [...ids, collection] : [...ids];
      const [rows] = await pool.execute(
        `SELECT id, name, slug, price, compare_at_price, images, stock, product_collection FROM products WHERE status='active' AND JSON_CONTAINS(COALESCE(tags, '[]'), JSON_QUOTE('__sarine_men_catalogue__')) AND id IN (${placeholders})${collectionFilter}`,
        productParams
      );
      const byId = new Map(rows.map(row => [row.id, row]));
      products = ids.map(id => byId.get(id)).filter(Boolean).map(row => {
        let images = []; try { images = JSON.parse(row.images || "[]"); } catch {}
        return { id: row.id, name: row.name, slug: row.slug, price: Number(row.price),
          compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
          images: Array.isArray(images) ? images : [], stock: Number(row.stock), productCollection: row.product_collection || null };
      });
    }
    res.set("Cache-Control", "no-store").json({ category, products });
  } catch (error) { next(error); }
});

publicRouter.post("/men-launch-signups", menSignupLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const consent = req.body?.consent === true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !consent) return res.status(400).json({ error: "Enter a valid email and agree to receive SARINE Men launch updates." });
    await ensureMenSubscribersSchema();
    const id = crypto.randomUUID();
    await pool.execute("INSERT INTO men_launch_subscribers (id, email, consent, source) VALUES (?, ?, 1, 'men-page') ON DUPLICATE KEY UPDATE email=VALUES(email)", [id, email]);
    res.status(201).json({ success: true, message: "You're on the list. We'll let you know when SARINE Men arrives." });
  } catch (error) { next(error); }
});
adminOnly.get("/men-launch-signups", async (_req, res, next) => {
  try {
    await ensureMenSubscribersSchema();
    const [rows] = await pool.execute("SELECT id, email, consent, source, created_at AS createdAt FROM men_launch_subscribers ORDER BY created_at DESC LIMIT 5000");
    res.set("Cache-Control", "no-store").json({ subscribers: rows.map(row => ({ ...row, consent: Boolean(row.consent) })) });
  } catch (error) { next(error); }
});
adminOnly.delete("/men-launch-signups/:id", async (req, res, next) => {
  try {
    await ensureMenSubscribersSchema();
    const [result] = await pool.execute("DELETE FROM men_launch_subscribers WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Signup not found." });
    res.json({ success: true });
  } catch (error) { next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicStorefrontRouter };
export default admin;


// Editorial Collection content is stored independently from hero banner records.
const editorialDefaults = {
  eyebrow: "EDITORIAL COLLECTION",
  title: "The Art of Everyday Elegance",
  description: "A curated collection that blends classic beauty with modern sensibilities.",
  ctaText: "Explore the Collection",
  ctaLink: "/shop",
  imageUrl: "/images/editorial-banner.jpg",
  active: true
};
function normalizeEditorial(value) {
  return { ...editorialDefaults, ...(value && typeof value === "object" ? value : {}) };
}
function parseEditorialRecord(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object" && saved.draft && saved.published) {
      return { draft: normalizeEditorial(saved.draft), published: normalizeEditorial(saved.published) };
    }
    // Existing records were a single live object. Treat them as both draft and published.
    const legacy = normalizeEditorial(saved);
    return { draft: legacy, published: legacy };
  } catch {
    return { draft: editorialDefaults, published: editorialDefaults };
  }
}
async function readEditorialRecord(collection = null) {
  await ensureSchema();
  const key = settingKey("editorial_collection", collection);
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [key]);
  if (rows.length) return parseEditorialRecord(rows[0].setting_value);
  // New collection versions inherit the existing Shared editorial until first saved independently.
  if (collection) {
    const [sharedRows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [settingKey("editorial_collection", null)]);
    if (sharedRows.length) return parseEditorialRecord(sharedRows[0].setting_value);
  }
  return { draft: editorialDefaults, published: editorialDefaults };
}
async function writeEditorialRecord(collection, record) {
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [settingKey("editorial_collection", collection), JSON.stringify(record)]
  );
}
function validateEditorial(input) {
  const editorial = {
    eyebrow: String(input.eyebrow ?? "").trim(),
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    ctaText: String(input.ctaText ?? "").trim(),
    ctaLink: String(input.ctaLink ?? "").trim(),
    imageUrl: String(input.imageUrl ?? "").trim(),
    active: input.active === true
  };
  if (!editorial.title || editorial.title.length > 180) throw Object.assign(new Error("Heading is required (maximum 180 characters)."), { status: 400 });
  if (editorial.eyebrow.length > 120 || editorial.description.length > 500 || editorial.ctaText.length > 80) throw Object.assign(new Error("Editorial text exceeds the allowed length."), { status: 400 });
  if (!editorial.imageUrl || editorial.imageUrl.length > 2048 || (!editorial.imageUrl.startsWith("/") && !/^https:\/\//i.test(editorial.imageUrl))) throw Object.assign(new Error("Choose a valid uploaded image."), { status: 400 });
  if (!(editorial.ctaLink.startsWith("/") && !editorial.ctaLink.startsWith("//")) && !/^https:\/\//i.test(editorial.ctaLink)) throw Object.assign(new Error("Button destination must be a site path or HTTPS URL."), { status: 400 });
  if (editorial.ctaLink.length > 500) throw Object.assign(new Error("Button destination is too long."), { status: 400 });
  return editorial;
}
adminOnly.get("/editorial", async (req, res, next) => {
  try {
    const record = await readEditorialRecord(collectionFrom(req.query.productCollection));
    res.set("Cache-Control", "no-store").json(record);
  } catch (error) { next(error); }
});
adminOnly.put("/editorial", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const record = await readEditorialRecord(collection);
    const draft = validateEditorial(req.body || {});
    await writeEditorialRecord(collection, { draft, published: record.published });
    res.json({ draft, published: record.published });
  } catch (error) { next(error); }
});
adminOnly.post("/editorial/publish", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const record = await readEditorialRecord(collection);
    await writeEditorialRecord(collection, { draft: record.draft, published: record.draft });
    res.json({ editorial: record.draft, draft: record.draft, published: record.draft });
  } catch (error) { next(error); }
});
async function readEditorial(collection = null) {
  const record = await readEditorialRecord(collection);
  return record.published;
}
publicRouter.get("/editorial", async (req, res, next) => {
  try {
    const editorial = await readEditorial(collectionFrom(req.query.productCollection));
    res.set("Cache-Control", "no-store").json({ editorial: editorial.active ? editorial : null });
  } catch (error) { next(error); }
});

// Public aggregate ratings include approved reviews only; customer details remain private.
publicRouter.get("/review-summaries", async (_req, res, next) => {
  try {
    await ensureReviewSchema();
    const [rows] = await pool.execute(
      `SELECT r.product_id, COUNT(*) AS count, AVG(r.rating) AS average
       FROM product_reviews r
       INNER JOIN products p ON p.id COLLATE utf8mb4_unicode_ci = r.product_id COLLATE utf8mb4_unicode_ci
       WHERE r.status = 'approved' AND p.status = 'active'
       GROUP BY r.product_id`
    );
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300").json({
      summaries: rows.map(row => ({
        productId: row.product_id,
        count: Number(row.count),
        average: Number(row.average)
      }))
    });
  } catch (error) { next(error); }
});

// Customer reviews are private until an administrator approves them.
// A guest proves purchase by supplying the order number and the email used at checkout.
async function ensureReviewSchema() {
  await ensureSchema();
  await pool.execute(`CREATE TABLE IF NOT EXISTS product_reviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    product_id VARCHAR(191) NOT NULL,
    order_id VARCHAR(191) NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(254) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL DEFAULT '',
    comment TEXT NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    admin_reply VARCHAR(1000) NULL,
    image_urls TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_review_order_product (order_id, product_id),
    INDEX idx_reviews_product_status (product_id, status, created_at),
    INDEX idx_reviews_status_date (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [columns] = await pool.execute("SHOW COLUMNS FROM product_reviews LIKE 'image_urls'");
  if (!columns.length) await pool.execute("ALTER TABLE product_reviews ADD COLUMN image_urls TEXT NULL");
}
async function ensureReviewMediaTable() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS media_assets (
    id CHAR(36) NOT NULL PRIMARY KEY, file_name VARCHAR(255) NOT NULL, mime_type VARCHAR(32) NOT NULL,
    file_size INT UNSIGNED NOT NULL, image_data MEDIUMBLOB NOT NULL, uploaded_by VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_media_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
const reviewImageUploadLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many photo uploads. Please try again later." } });
publicRouter.post("/review-images", reviewImageUploadLimit, async (req, res, next) => {
  try {
    const { buffer, fileName, mimeType } = validateImageUpload(req.body || {});
    await ensureReviewMediaTable();
    const id = crypto.randomUUID();
    await pool.execute("INSERT INTO media_assets (id, file_name, mime_type, file_size, image_data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)", [id, fileName, mimeType, buffer.length, buffer, "customer-review"]);
    res.status(201).json({ success: true, media: { id, url: "/api/media/" + id } });
  } catch (error) {
    if (error.message?.includes("image") || error.message?.includes("filename") || error.message?.includes("JPEG") || error.message?.includes("2 MB")) return res.status(400).json({ error: error.message });
    next(error);
  }
});
function mapReview(row) {
  let imageUrls = [];
  try { imageUrls = row.image_urls ? JSON.parse(row.image_urls) : []; } catch {}
  return {
    id: row.id, productId: row.product_id, name: row.customer_name,
    rating: Number(row.rating), title: row.title, comment: row.comment,
    status: row.status, verified: true, adminReply: row.admin_reply || "",
    imageUrls, date: row.created_at
  };
}
publicRouter.get("/products/:productId/reviews", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const productId = String(req.params.productId || "");
    const [rows] = await pool.execute("SELECT id, product_id, customer_name, rating, title, comment, status, admin_reply, image_urls, created_at FROM product_reviews WHERE product_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND status='approved' ORDER BY created_at DESC LIMIT 100", [productId]);
    const [summary] = await pool.execute("SELECT COUNT(*) AS count, COALESCE(AVG(rating),0) AS average FROM product_reviews WHERE product_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND status='approved'", [productId]);
    res.set("Cache-Control", "no-store").json({ reviews: rows.map(mapReview), count: Number(summary[0].count), average: Number(summary[0].average) });
  } catch (error) { next(error); }
});
publicRouter.post("/products/:productId/reviews", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const productId = String(req.params.productId || "").trim();
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const orderNumber = String(req.body?.orderNumber || "").trim();
    const rating = Number(req.body?.rating);
    const title = String(req.body?.title || "").trim();
    const comment = String(req.body?.comment || "").trim();
    const imageIds = Array.isArray(req.body?.imageIds) ? req.body.imageIds : [];
    if (imageIds.length > 3 || imageIds.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) || new Set(imageIds).size !== imageIds.length) return res.status(400).json({ error: "You can attach up to 3 valid product photos." });
    if (!productId || !name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !orderNumber || orderNumber.length > 64 || !Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length < 10 || comment.length > 3000 || title.length > 160) {
      return res.status(400).json({ error: "Enter your name, valid checkout email, order number, 1–5 star rating and feedback (10–3000 characters)." });
    }
    const [orders] = await pool.execute("SELECT id FROM orders WHERE order_number COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND LOWER(customer_email) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND order_status='delivered' LIMIT 1", [orderNumber, email]);
    if (!orders.length) return res.status(400).json({ error: "We could not match that order number and checkout email. Please check both details." });
    const [items] = await pool.execute("SELECT product_id FROM order_items WHERE order_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci AND product_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci LIMIT 1", [orders[0].id, productId]);
    if (!items.length) return res.status(403).json({ error: "That product is not included in the supplied order." });
    if (imageIds.length) {
      await ensureReviewMediaTable();
      const placeholders = imageIds.map(() => "?").join(",");
      const [mediaRows] = await pool.execute(`SELECT id FROM media_assets WHERE id IN (${placeholders})`, imageIds);
      if (mediaRows.length !== imageIds.length) return res.status(400).json({ error: "One or more uploaded review photos could not be found. Please upload them again." });
    }
    const imageUrls = imageIds.map(id => "/api/media/" + id);
    const id = crypto.randomUUID();
    try {
      await pool.execute("INSERT INTO product_reviews (id, product_id, order_id, customer_name, customer_email, rating, title, comment, image_urls, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')", [id, productId, orders[0].id, name, email, rating, title, comment, JSON.stringify(imageUrls)]);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A review has already been submitted for this product and order." });
      throw error;
    }
    res.status(201).json({ success: true, message: "Thank you. Your review has been submitted for moderation." });
  } catch (error) { next(error); }
});
adminOnly.get("/reviews", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const status = ["pending","approved","rejected","all"].includes(String(req.query.status)) ? String(req.query.status) : "pending";
    const where = status === "all" ? "" : "WHERE r.status=?";
    const params = status === "all" ? [] : [status];
    const [rows] = await pool.execute(`SELECT r.id, r.product_id, r.order_id, r.customer_name, r.customer_email, r.rating, r.title, r.comment, r.status, r.admin_reply, r.image_urls, r.created_at, p.name AS product_name, o.order_number FROM product_reviews r LEFT JOIN products p ON p.id COLLATE utf8mb4_unicode_ci = r.product_id COLLATE utf8mb4_unicode_ci LEFT JOIN orders o ON o.id COLLATE utf8mb4_unicode_ci = r.order_id COLLATE utf8mb4_unicode_ci ${where} ORDER BY r.created_at DESC LIMIT 300`, params);
    res.set("Cache-Control", "no-store").json({ reviews: rows.map(row => ({ ...mapReview(row), email: row.customer_email, orderNumber: row.order_number, productName: row.product_name })) });
  } catch (error) { next(error); }
});
adminOnly.patch("/reviews/:id", async (req, res, next) => {
  try {
    await ensureReviewSchema();
    const status = String(req.body?.status || "");
    const reply = String(req.body?.adminReply || "").trim();
    if (!["approved","rejected","pending"].includes(status) || reply.length > 1000) return res.status(400).json({ error: "Choose a valid moderation status and reply (maximum 1000 characters)." });
    const [result] = await pool.execute("UPDATE product_reviews SET status=?, admin_reply=? WHERE id=?", [status, reply || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Review not found." });
    res.json({ success: true });
  } catch (error) { next(error); }
});


// Shared header/footer content with isolated draft and published snapshots.
const defaultSiteChrome = {
  version: 1,
  header: { tagline: "LUXURY ARTIFICIAL JEWELLERY" },
  footer: {
    tagline: "Timeless jewellery for every you.",
    copyright: "© 2026 SARINE. All rights reserved.",
    social: { facebook: "https://facebook.com", pinterest: "https://pinterest.com", youtube: "https://youtube.com" },
    headings: { shop: "Shop", care: "Customer Care", about: "About", payments: "Payment Methods" }
  }
};
function validateSiteChrome(input) {
  const value = input && typeof input === "object" ? input : {};
  const header = { ...defaultSiteChrome.header, ...(value.header || {}) };
  const footer = { ...defaultSiteChrome.footer, ...(value.footer || {}) };
  const cleanText = (value, fallback, max) => {
    const text = typeof value === "string" ? value.trim() : fallback;
    if (text.length > max) throw new Error("Header and footer text exceeds the allowed length.");
    return text;
  };
  header.tagline = cleanText(header.tagline, defaultSiteChrome.header.tagline, 100);
  footer.tagline = cleanText(footer.tagline, defaultSiteChrome.footer.tagline, 140);
  footer.copyright = cleanText(footer.copyright, defaultSiteChrome.footer.copyright, 140);
  const headings = { ...defaultSiteChrome.footer.headings, ...(footer.headings || {}) };
  for (const key of Object.keys(headings)) headings[key] = cleanText(headings[key], defaultSiteChrome.footer.headings[key], 50);
  const social = { ...defaultSiteChrome.footer.social, ...(footer.social || {}) };
  for (const [key, url] of Object.entries(social)) {
    if (typeof url !== "string" || url.length > 300 || !/^https:\/\//i.test(url)) throw new Error("Social profile links must be HTTPS URLs.");
    social[key] = url;
  }
  return { version: 1, header, footer: { tagline: footer.tagline, copyright: footer.copyright, headings, social } };
}
async function readSiteChrome() {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='site_chrome' LIMIT 1");
  if (!rows.length) return { draft: defaultSiteChrome, published: defaultSiteChrome };
  try {
    const record = JSON.parse(rows[0].setting_value);
    return { draft: validateSiteChrome(record.draft || defaultSiteChrome), published: validateSiteChrome(record.published || defaultSiteChrome) };
  } catch { return { draft: defaultSiteChrome, published: defaultSiteChrome }; }
}
async function writeSiteChrome(record) {
  await pool.execute("INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('site_chrome', ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [JSON.stringify(record)]);
}
adminOnly.get("/site-chrome", async (_req, res, next) => {
  try { res.set("Cache-Control", "no-store").json(await readSiteChrome()); } catch (error) { next(error); }
});
adminOnly.put("/site-chrome", async (req, res, next) => {
  try {
    let draft;
    try { draft = validateSiteChrome(req.body?.settings); } catch (error) { return res.status(400).json({ error: error.message }); }
    const record = await readSiteChrome();
    await writeSiteChrome({ ...record, draft });
    res.set("Cache-Control", "no-store").json({ success: true, draft });
  } catch (error) { next(error); }
});
adminOnly.post("/site-chrome/publish", async (_req, res, next) => {
  try {
    const record = await readSiteChrome();
    const published = validateSiteChrome(record.draft);
    await writeSiteChrome({ ...record, published });
    res.set("Cache-Control", "no-store").json({ success: true, published });
  } catch (error) { next(error); }
});
publicRouter.get("/site-chrome", async (_req, res, next) => {
  try {
    const record = await readSiteChrome();
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300").json({ settings: record.published });
  } catch (error) { next(error); }
});
