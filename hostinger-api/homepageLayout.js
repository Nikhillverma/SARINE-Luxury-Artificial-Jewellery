import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

import { DEFAULT_HOMEPAGE_LAYOUT, validateHomepageLayout } from "./homepageLayoutPolicy.js";

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

async function readSetting(key, fallback) {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [key]);
  if (!rows.length) return fallback;
  try {
    return validateHomepageLayout(JSON.parse(rows[0].setting_value));
  } catch {
    return fallback;
  }
}

function layoutSettingKey(kind, collection) {
  return collection ? "homepage_layout_" + kind + "_" + collection : "homepage_layout_" + kind;
}
async function readLayout(kind, collection) {
  const shared = await readSetting(layoutSettingKey(kind, null), DEFAULT_HOMEPAGE_LAYOUT);
  if (!collection) return shared;
  return readSetting(layoutSettingKey(kind, collection), shared);
}

async function writeSetting(key, value) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(value)]
  );
}

adminOnly.get("/", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.query.productCollection);
    const [draft, published] = await Promise.all([
      readLayout("draft", collection),
      readLayout("published", collection)
    ]);
    res.set("Cache-Control", "no-store").json({ draft, published, collection: collection || "shared" });
  } catch (error) { if (error instanceof Error && /product collection/i.test(error.message)) return res.status(400).json({ error: error.message }); next(error); }
});

adminOnly.put("/draft", async (req, res, next) => {
  try {
    const layout = validateHomepageLayout(req.body);
    const collection = collectionFrom(req.body?.productCollection);
    await writeSetting(layoutSettingKey("draft", collection), layout);
    res.set("Cache-Control", "no-store").json({ success: true, draft: layout, collection: collection || "shared" });
  } catch (error) {
    if (error instanceof Error && /homepage|section|position|supported|duplicated|enabled|order|exactly once|cards per view|carousel|product collection/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

adminOnly.post("/publish", async (_req, res, next) => {
  try {
    const collection = collectionFrom(_req.body?.productCollection);
    const draft = await readLayout("draft", collection);
    await writeSetting(layoutSettingKey("published", collection), draft);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft, collection: collection || "shared" });
  } catch (error) { if (error instanceof Error && /product collection/i.test(error.message)) return res.status(400).json({ error: error.message }); next(error); }
});

publicRouter.get("/", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.query.productCollection);
    const layout = await readLayout("published", collection);
    res.set("Cache-Control", "no-store").json({ layout, collection: collection || "shared" });
  } catch (error) { if (error instanceof Error && /product collection/i.test(error.message)) return res.status(400).json({ error: error.message }); next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicHomepageLayoutRouter };
export default admin;


// Editable copy and artwork for the remaining homepage content sections.
// Kept separately from layout visibility/order so drafts never affect the live homepage.
export const DEFAULT_HOMEPAGE_CONTENT = Object.freeze({
  version: 1,
  price: {
    eyebrow: "PRICE CURATION",
    title: "Shop by Price",
    description: "Find stunning handcrafted jewellery suited to your style and budget.",
    links: [
      { label: "Under ₹999", href: "/shop?price=under-999" },
      { label: "₹1,000 to ₹1,999", href: "/shop?price=1000-2000" },
      { label: "₹2,000 and above", href: "/shop?price=above-2000" },
      { label: "All pieces", href: "/shop" }
    ]
  },
  story: {
    eyebrow: "OUR STORY",
    title: "More Than Just Jewellery",
    paragraphs: [
      "SARINE is a premium Indian fashion jewellery brand created to bring timeless elegance to your everyday moments. We celebrate traditional motifs through modern design, curating versatile pieces that seamlessly elevate both celebrations and daily attire.",
      "We believe in accessible luxury — exquisite craftsmanship, refined finishes, and enduring beauty at honest, direct prices. Every piece is crafted so you can express your personal grace with confidence and ease."
    ],
    imageUrl: "/images/optimized/our-story.webp",
    ctaText: "Our Story",
    ctaLink: "/about",
    pillars: [
      { title: "Thoughtfully Designed", description: "for Everyday Elegance" },
      { title: "Artisanal Heritage", description: "& Modern Craft" },
      { title: "Accessible Luxury", description: "for Every You" }
    ]
  },
  care: {
    eyebrow: "ATELIER CARE PHILOSOPHY",
    title: "The Art of Jewellery Preservation",
    description: "Every SARINE piece is crafted with protective seals and demi-fine gold plating. Follow these four timeless steps to preserve its radiant shine for generations.",
    steps: [
      { title: "The Last Touch", description: "Put your jewellery on last after perfumes, lotions, and hair styling sprays have dried completely." },
      { title: "Air-Tight Storage", description: "Store each piece in its individual velvet pouch or zip bag to prevent moisture and accidental scratches." },
      { title: "Gentle Cleaning", description: "Wipe gently with a dry soft microfiber cloth after wear to remove skin oils before returning to storage." },
      { title: "Moisture Barrier", description: "Keep pieces away from steam, pool chlorine, and water basins to maintain pristine prong tension." }
    ]
  },
  contact: {
    eyebrow: "STAY IN TOUCH",
    title: "Connect With SARINE",
    description: "Have questions about styling, care, or your order? Connect with our customer care team on our",
    linkText: "Contact page",
    linkHref: "/contact"
  }
});

function validateHomepageContent(input) {
  if (!input || typeof input !== "object" || input.version !== 1) throw new Error("Homepage content version is invalid.");
  const text = (value, label, max, required = true) => {
    if (typeof value !== "string") throw new Error(label + " must be text.");
    const clean = value.trim();
    if ((required && !clean) || clean.length > max) throw new Error(label + (required ? " is required" : " is too long") + " (maximum " + max + " characters).");
    return clean;
  };
  const internalPath = (value, label) => {
    const path = text(value, label, 500);
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\n") || path.includes("\\r")) throw new Error(label + " must be an internal site path.");
    return path;
  };
  const imagePath = text(input.story?.imageUrl, "Our Story image", 2048);
  if (!(imagePath.startsWith("/") && !imagePath.startsWith("//")) && !imagePath.toLowerCase().startsWith("https://")) throw new Error("Our Story image must be an uploaded site image or HTTPS URL.");
  const list = (value, count, label, maxTitle, maxDescription) => {
    if (!Array.isArray(value) || value.length !== count) throw new Error(label + " must contain exactly " + count + " items.");
    return value.map((item, index) => ({
      title: text(item?.title, label + " " + (index + 1) + " title", maxTitle),
      description: text(item?.description, label + " " + (index + 1) + " description", maxDescription)
    }));
  };
  if (!Array.isArray(input.price?.links) || input.price.links.length !== 4) throw new Error("Shop by Price must contain exactly four links.");
  return {
    version: 1,
    price: {
      eyebrow: text(input.price.eyebrow, "Price eyebrow", 80),
      title: text(input.price.title, "Price heading", 120),
      description: text(input.price.description, "Price description", 300),
      links: input.price.links.map((item, index) => ({
        label: text(item?.label, "Price link " + (index + 1) + " label", 60),
        href: internalPath(item?.href, "Price link " + (index + 1) + " destination")
      }))
    },
    story: {
      eyebrow: text(input.story?.eyebrow, "Our Story eyebrow", 80),
      title: text(input.story?.title, "Our Story heading", 140),
      paragraphs: (() => {
        if (!Array.isArray(input.story?.paragraphs) || input.story.paragraphs.length !== 2) throw new Error("Our Story must contain exactly two paragraphs.");
        return input.story.paragraphs.map((item, index) => text(item, "Our Story paragraph " + (index + 1), 700));
      })(),
      imageUrl: imagePath,
      ctaText: text(input.story?.ctaText, "Our Story button label", 60),
      ctaLink: internalPath(input.story?.ctaLink, "Our Story button destination"),
      pillars: list(input.story?.pillars, 3, "Brand pillar", 60, 100)
    },
    care: {
      eyebrow: text(input.care?.eyebrow, "Care eyebrow", 80),
      title: text(input.care?.title, "Care heading", 140),
      description: text(input.care?.description, "Care introduction", 500),
      steps: list(input.care?.steps, 4, "Care step", 60, 300)
    },
    contact: {
      eyebrow: text(input.contact?.eyebrow, "Contact eyebrow", 80),
      title: text(input.contact?.title, "Contact heading", 140),
      description: text(input.contact?.description, "Contact description", 300),
      linkText: text(input.contact?.linkText, "Contact link label", 60),
      linkHref: internalPath(input.contact?.linkHref, "Contact link destination")
    }
  };
}

async function readHomepageContent(key) {
  await ensureSchema();
  const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1", [key]);
  if (!rows.length) return DEFAULT_HOMEPAGE_CONTENT;
  try { return validateHomepageContent(JSON.parse(rows[0].setting_value)); }
  catch { return DEFAULT_HOMEPAGE_CONTENT; }
}
async function writeHomepageContent(key, content) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(content)]
  );
}

function collectionFrom(value) { const v = String(value || "").trim().toLowerCase(); if (!v) return null; if (v !== "artificial" && v !== "demi-fine") throw new Error("Product collection must be artificial or demi-fine."); return v; }
function collectionKey(base, collection) { return collection ? base + "_" + collection : base; }
adminOnly.get("/content", async (req, res, next) => {
  try {
    const [draft, published] = await Promise.all([
      readHomepageContent(collectionKey("homepage_content_draft", collectionFrom(req.query.productCollection))),
      readHomepageContent(collectionKey("homepage_content_published", collectionFrom(req.query.productCollection)))
    ]);
    res.set("Cache-Control", "no-store").json({ draft, published });
  } catch (error) { next(error); }
});
adminOnly.put("/content/draft", async (req, res, next) => {
  try {
    const content = validateHomepageContent(req.body);
    await writeHomepageContent(collectionKey("homepage_content_draft", collectionFrom(req.body?.productCollection)), content);
    res.set("Cache-Control", "no-store").json({ success: true, draft: content });
  } catch (error) {
    if (error instanceof Error && /must|is required|maximum|exactly|destination|image|version|characters|path/i.test(error.message)) return res.status(400).json({ error: error.message });
    next(error);
  }
});
adminOnly.post("/content/publish", async (req, res, next) => {
  try {
    const collection = collectionFrom(req.body?.productCollection);
    const draft = await readHomepageContent(collectionKey("homepage_content_draft", collection));
    await writeHomepageContent(collectionKey("homepage_content_published", collection), draft);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft });
  } catch (error) { next(error); }
});
publicRouter.get("/content", async (req, res, next) => {
  try {
    const content = await readHomepageContent(collectionKey("homepage_content_published", collectionFrom(req.query.productCollection)));
    res.set("Cache-Control", "no-store").json({ content });
  } catch (error) { next(error); }
});
