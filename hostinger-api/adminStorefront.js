import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

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
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_storefront_banners_active_order (is_active, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch(error => { schemaReady = undefined; throw error; });
  }
  await schemaReady;
}

function mapBanner(row) {
  return {
    id: row.id, tagline: row.tagline, title: row.title, subtitle: row.subtitle,
    ctaText: row.cta_text, ctaLink: row.cta_link, imageUrl: row.image_url,
    active: Boolean(row.is_active), sortOrder: Number(row.sort_order)
  };
}
function validate(input) {
  const title = String(input.title || "").trim();
  const imageUrl = String(input.imageUrl || "").trim();
  const ctaLink = String(input.ctaLink || "/shop").trim();
  if (!title || title.length > 180) return "Banner title is required (maximum 180 characters).";
  if (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 2048) return "Banner image must be a valid HTTPS media URL.";
  if (!(ctaLink.startsWith("/") && !ctaLink.startsWith("//")) && !/^https:\/\//i.test(ctaLink)) return "CTA destination must be a site path or HTTPS URL.";
  if (ctaLink.length > 500) return "CTA destination is too long.";
  return null;
}

adminOnly.get("/banners", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT * FROM storefront_banners ORDER BY sort_order ASC, created_at ASC");
    res.set("Cache-Control", "no-store").json({ banners: rows.map(mapBanner) });
  } catch (error) { next(error); }
});
adminOnly.post("/banners", async (req, res, next) => {
  try {
    await ensureSchema();
    const input = req.body || {};
    const invalid = validate(input);
    if (invalid) return res.status(400).json({ error: invalid });
    const id = crypto.randomUUID();
    const [count] = await pool.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM storefront_banners");
    await pool.execute(
      `INSERT INTO storefront_banners
       (id, tagline, title, subtitle, cta_text, cta_link, image_url, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(input.tagline || "").slice(0,120), String(input.title).trim(),
       String(input.subtitle || "").slice(0,500), String(input.ctaText || "Shop now").slice(0,80),
       String(input.ctaLink || "/shop").trim(), String(input.imageUrl).trim(),
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
    const invalid = validate(merged);
    if (invalid) return res.status(400).json({ error: invalid });
    await pool.execute(
      `UPDATE storefront_banners SET tagline=?, title=?, subtitle=?, cta_text=?, cta_link=?,
       image_url=?, is_active=?, sort_order=? WHERE id=?`,
      [String(merged.tagline || "").slice(0,120), String(merged.title).trim(),
       String(merged.subtitle || "").slice(0,500), String(merged.ctaText || "Shop now").slice(0,80),
       String(merged.ctaLink || "/shop").trim(), String(merged.imageUrl).trim(),
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
    await ensureSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (let i = 0; i < ids.length; i++) await connection.execute("UPDATE storefront_banners SET sort_order=? WHERE id=?", [i, ids[i]]);
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
    const message = String(req.body?.message || "").trim();
    const active = req.body?.active === true;
    const trustMessages = Array.isArray(req.body?.trustMessages)
      ? req.body.trustMessages.slice(0, 3).map(item => String(item || "").trim())
      : [];
    if (message.length > 300) return res.status(400).json({ error: "Announcement must be 300 characters or fewer." });
    if (trustMessages.some(item => item.length > 100)) return res.status(400).json({ error: "Each trust message must be 100 characters or fewer." });
    await pool.execute(
      "INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('announcement', ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
      [JSON.stringify({ message, active, trustMessages })]
    );
    res.json({ success: true, announcement: { message, active, trustMessages } });
  } catch (error) { next(error); }
});
adminOnly.get("/announcement", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    let announcement = { message: "", active: false, trustMessages: ["Free Shipping Above ₹1,999", "7-Day Easy Returns", "Trusted by 1L+ Happy Customers"] };
    if (rows.length) {
      try {
        const saved = JSON.parse(rows[0].setting_value);
        announcement = {
          message: typeof saved.message === "string" ? saved.message : "",
          active: saved.active === true,
          trustMessages: Array.isArray(saved.trustMessages) && saved.trustMessages.length
            ? saved.trustMessages.slice(0, 3).map(item => String(item || "").trim().slice(0, 100))
            : ["Free Shipping Above ₹1,999", "7-Day Easy Returns", "Trusted by 1L+ Happy Customers"]
        };
      } catch {}
    }
    res.set("Cache-Control", "no-store").json({ announcement });
  } catch (error) { next(error); }
});


const DEFAULT_LAYOUT={version:1,sections:["hero","categories","new-arrivals","best-sellers","curated-favourites","occasions","explore-now","price","our-story","editorial","care-guide","stay-in-touch"].map((id,sortOrder)=>({id,enabled:true,sortOrder}))};
const DEFAULT_CURATED={version:1,productIds:[],configured:false};
const DEFAULT_EXPLORE={version:1,productIds:[],displayCount:8,configured:false};
async function readSetting(key,fallback){await ensureSchema();const [rows]=await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1",[key]);if(!rows.length)return fallback;try{return JSON.parse(rows[0].setting_value)}catch{return fallback}}
async function writeSetting(key,value){await ensureSchema();await pool.execute("INSERT INTO storefront_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[key,JSON.stringify(value)])}
const DEFAULT_GLOBAL_DESIGN = {"version":2,"colors":{"primary":"#563568","accent":"#B69ACF","surface":"#FFFFFF","pageBackground":"#FFFFFF","text":"#302438","headerBackground":"#FFFFFF","footerBackground":"#563568","footerText":"#FFFFFF"},"typography":{"headingFont":"Cormorant Garamond","bodyFont":"Plus Jakarta Sans","headingScale":100,"bodyScale":100},"layout":{"contentWidth":1280,"cornerRadius":8},"components":{"buttonStyle":"solid"},"elements":{"text":{"heading":"#302438","body":"#5A4F5E","goldText":"#563568","muted":"#806F89","link":"#563568","linkHover":"#B69ACF"},"buttons":{"primaryBackground":"#563568","primaryText":"#FFFFFF","primaryHoverBackground":"#B69ACF","primaryPressedBackground":"#442753","secondaryBorder":"#B69ACF","secondaryText":"#302438"},"surfaces":{"alternateSection":"#F7F0FA","card":"#FFFFFF","border":"#E7DCEB","pill":"#F7F0FA"},"productCards":{"saleBadgeBackground":"#563568","saleBadgeText":"#FFFFFF","sellingPrice":"#563568","oldPrice":"#806F89","starRating":"#B69ACF","categoryLabel":"#563568"},"announcement":{"background":"#563568","text":"#FFFFFF","separator":"#B69ACF"},"hero":{"caption":"#B69ACF","heading":"#FFFFFF","paragraph":"#FFFFFF"},"countdown":{"background":"#F7F0FA","border":"#B69ACF","text":"#563568"},"footer":{"background":"#563568","headings":"#FFFFFF","links":"#FFFFFF","linkHover":"#B69ACF","divider":"#806F89","bottomText":"#F7F0FA"}},"fonts":{"logo":{"family":"Cormorant Garamond","sizeScale":100,"weight":600},"heading":{"family":"Cormorant Garamond","sizeScale":100,"weight":600},"body":{"family":"Plus Jakarta Sans","sizeScale":100,"weight":400},"buttonLabel":{"family":"Plus Jakarta Sans","sizeScale":100,"weight":600}}};
const DESIGN_FONT_FAMILIES = new Set(["Cormorant Garamond","Plus Jakarta Sans","Playfair Display","DM Sans","Lato","Montserrat","Poppins","Inter","Roboto","Georgia","Arial"]);
const DESIGN_WEIGHTS = new Set([300,400,500,600,700]);
const DESIGN_HEX = /^#[0-9A-Fa-f]{6}$/;
function mergeDesign(base,value) {
  if (!base || typeof base !== "object" || Array.isArray(base)) return value === undefined ? base : value;
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const merged = {};
  for (const key of Object.keys(base)) merged[key] = mergeDesign(base[key],source[key]);
  return merged;
}
const DEFAULT_RESPONSIVE_TYPOGRAPHY = {"desktop":{"h1":60,"h2":42,"h3":28,"h4":20,"body":16,"small":13,"button":14},"tablet":{"h1":48,"h2":36,"h3":24,"h4":19,"body":15,"small":12,"button":14},"mobile":{"h1":38,"h2":30,"h3":21,"h4":18,"body":14,"small":12,"button":13},"tabletOverride":false,"mobileOverride":false};
function normalizeGlobalDesign(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const d = mergeDesign(DEFAULT_GLOBAL_DESIGN,source);
  const isLegacy = Number(source.version || 1) < 2 || !source.elements;
  if (isLegacy) {
    const colors = source.colors || {};
    // Legacy primary text was the heading/primary foreground, not body copy.
    d.elements.text.heading = colors.text || d.elements.text.heading;
    d.elements.text.link = colors.primary || d.elements.text.link;
    d.elements.text.linkHover = colors.accent || d.elements.text.linkHover;
    d.elements.buttons.primaryBackground = colors.primary || d.elements.buttons.primaryBackground;
    d.elements.buttons.primaryText = colors.surface || d.elements.buttons.primaryText;
    d.elements.buttons.primaryHoverBackground = colors.accent || d.elements.buttons.primaryHoverBackground;
    d.elements.buttons.secondaryBorder = colors.accent || d.elements.buttons.secondaryBorder;
    d.elements.surfaces.card = colors.surface || d.elements.surfaces.card;
    d.elements.announcement.background = colors.primary || d.elements.announcement.background;
    d.elements.footer.background = colors.footerBackground || d.elements.footer.background;
    d.elements.footer.links = colors.footerText || d.elements.footer.links;
    // Body remains the new palette default (#5A4F5E); old primary text is not body text.
    if (source.typography) {
      d.fonts.logo.family = source.typography.headingFont || d.fonts.logo.family;
      d.fonts.heading.family = source.typography.headingFont || d.fonts.heading.family;
      d.fonts.body.family = source.typography.bodyFont || d.fonts.body.family;
      d.fonts.buttonLabel.family = source.typography.bodyFont || d.fonts.buttonLabel.family;
      d.fonts.heading.sizeScale = Number(source.typography.headingScale) || d.fonts.heading.sizeScale;
      d.fonts.body.sizeScale = Number(source.typography.bodyScale) || d.fonts.body.sizeScale;
    }
  }
  d.responsiveTypography = mergeDesign(DEFAULT_RESPONSIVE_TYPOGRAPHY, source.responsiveTypography);
  d.version = 2;
  return d;
}
function validateGlobalDesign(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Design settings must be an object.";
  const d = normalizeGlobalDesign(value);
  for (const group of ["text","buttons","surfaces","productCards","announcement","hero","countdown","footer"]) {
    for (const [key,color] of Object.entries(d.elements[group] || {})) if (typeof color !== "string" || !DESIGN_HEX.test(color)) return `Invalid hex colour at elements.${group}.${key}; use #RRGGBB.`;
  }
  for (const [key,color] of Object.entries(d.colors || {})) if (typeof color !== "string" || !DESIGN_HEX.test(color)) return `Invalid legacy hex colour at colors.${key}; use #RRGGBB.`;
  for (const device of ["desktop","tablet","mobile"]) {
    const scale=d.responsiveTypography?.[device];
    for (const key of ["h1","h2","h3","h4","body","small","button"]) if (!Number.isFinite(scale?.[key]) || scale[key]<10 || scale[key]>96) return `Responsive ${device} ${key} size must be between 10px and 96px.`;
  }
  if (typeof d.responsiveTypography.tabletOverride!=="boolean" || typeof d.responsiveTypography.mobileOverride!=="boolean") return "Responsive typography override flags must be boolean.";
  for (const role of ["logo","heading","body","buttonLabel"]) {
    const f=d.fonts?.[role];
    if (!f || !DESIGN_FONT_FAMILIES.has(f.family)) return `Invalid font family for ${role}.`;
    if (!Number.isFinite(f.sizeScale) || f.sizeScale<70 || f.sizeScale>150) return `Font size scale for ${role} must be between 70 and 150.`;
    if (!DESIGN_WEIGHTS.has(f.weight)) return `Invalid font weight for ${role}.`;
  }
  if (![1120,1200,1280,1360].includes(d.layout.contentWidth)) return "Invalid content width.";
  if (![0,4,8,16].includes(d.layout.cornerRadius)) return "Invalid corner radius.";
  if (!["solid","outline"].includes(d.components.buttonStyle)) return "Invalid button style.";
  if (!["Cormorant Garamond","Georgia","Playfair Display"].includes(d.typography.headingFont)) return "Invalid legacy heading font.";
  if (!["Plus Jakarta Sans","Arial","DM Sans"].includes(d.typography.bodyFont)) return "Invalid legacy body font.";
  for (const n of [d.typography.headingScale,d.typography.bodyScale]) if (!Number.isFinite(n)||n<70||n>150) return "Legacy typography scale must be between 70 and 150.";
  return null;
}
function sanitizeStoredGlobalDesign(value, key) {
  const d = normalizeGlobalDesign(value);
  const warn = field => console.warn(`[storefront-design] Invalid stored value at ${key}.${field}; using the field default.`);
  for (const group of ["text","buttons","surfaces","productCards","announcement","hero","countdown","footer"]) {
    for (const field of Object.keys(DEFAULT_GLOBAL_DESIGN.elements[group])) {
      const color = d.elements[group][field];
      if (typeof color !== "string" || !DESIGN_HEX.test(color)) {
        d.elements[group][field] = DEFAULT_GLOBAL_DESIGN.elements[group][field];
        warn(`elements.${group}.${field}`);
      }
    }
  }
  for (const field of Object.keys(DEFAULT_GLOBAL_DESIGN.colors)) {
    const color = d.colors[field];
    if (typeof color !== "string" || !DESIGN_HEX.test(color)) {
      d.colors[field] = DEFAULT_GLOBAL_DESIGN.colors[field];
      warn(`colors.${field}`);
    }
  }
  for (const device of ["desktop","tablet","mobile"]) {
    for (const field of ["h1","h2","h3","h4","body","small","button"]) {
      const value=d.responsiveTypography?.[device]?.[field];
      if (!Number.isFinite(value)||value<10||value>96) d.responsiveTypography[device][field]=DEFAULT_RESPONSIVE_TYPOGRAPHY[device][field];
    }
  }
  if (typeof d.responsiveTypography.tabletOverride!=="boolean") d.responsiveTypography.tabletOverride=false;
  if (typeof d.responsiveTypography.mobileOverride!=="boolean") d.responsiveTypography.mobileOverride=false;
  for (const role of ["logo","heading","body","buttonLabel"]) {
    const font = d.fonts[role];
    if (!DESIGN_FONT_FAMILIES.has(font.family)) { font.family = DEFAULT_GLOBAL_DESIGN.fonts[role].family; warn(`fonts.${role}.family`); }
    if (!Number.isFinite(font.sizeScale) || font.sizeScale < 70 || font.sizeScale > 150) { font.sizeScale = DEFAULT_GLOBAL_DESIGN.fonts[role].sizeScale; warn(`fonts.${role}.sizeScale`); }
    if (!DESIGN_WEIGHTS.has(font.weight)) { font.weight = DEFAULT_GLOBAL_DESIGN.fonts[role].weight; warn(`fonts.${role}.weight`); }
  }
  if (![1120,1200,1280,1360].includes(d.layout.contentWidth)) { d.layout.contentWidth = DEFAULT_GLOBAL_DESIGN.layout.contentWidth; warn("layout.contentWidth"); }
  if (![0,4,8,16].includes(d.layout.cornerRadius)) { d.layout.cornerRadius = DEFAULT_GLOBAL_DESIGN.layout.cornerRadius; warn("layout.cornerRadius"); }
  if (!["solid","outline"].includes(d.components.buttonStyle)) { d.components.buttonStyle = DEFAULT_GLOBAL_DESIGN.components.buttonStyle; warn("components.buttonStyle"); }
  if (!["Cormorant Garamond","Georgia","Playfair Display"].includes(d.typography.headingFont)) { d.typography.headingFont = DEFAULT_GLOBAL_DESIGN.typography.headingFont; warn("typography.headingFont"); }
  if (!["Plus Jakarta Sans","Arial","DM Sans"].includes(d.typography.bodyFont)) { d.typography.bodyFont = DEFAULT_GLOBAL_DESIGN.typography.bodyFont; warn("typography.bodyFont"); }
  for (const field of ["headingScale","bodyScale"]) if (!Number.isFinite(d.typography[field]) || d.typography[field] < 70 || d.typography[field] > 150) { d.typography[field] = DEFAULT_GLOBAL_DESIGN.typography[field]; warn(`typography.${field}`); }
  return d;
}
let legacyDesignMigrationPromise;
async function migrateLegacyGlobalDesign() {
  if (!legacyDesignMigrationPromise) {
    legacyDesignMigrationPromise = (async () => {
      const legacy = await readSetting("global_design",null);
      if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return;
      for (const [field,key] of [["draft","global_design_draft"],["published","global_design_published"]]) {
        const oldValue = legacy[field];
        if (!oldValue || typeof oldValue !== "object" || Array.isArray(oldValue)) continue;
        await ensureSchema();
        await pool.execute(
          "INSERT IGNORE INTO storefront_settings (setting_key,setting_value) VALUES (?,?)",
          [key,JSON.stringify(normalizeGlobalDesign(oldValue))]
        );
      }
    })().catch(error => { legacyDesignMigrationPromise = undefined; throw error; });
  }
  await legacyDesignMigrationPromise;
}
function toLegacyGlobalDesign(value) {
  const d = normalizeGlobalDesign(value);
  return { version:1, colors:d.colors, typography:d.typography, layout:d.layout, components:d.components };
}
async function writeLegacyGlobalDesignPart(field,value) {
  const current = await readSetting("global_design",null);
  const record = current && typeof current === "object" && !Array.isArray(current)
    ? { ...current }
    : { draft:toLegacyGlobalDesign(DEFAULT_GLOBAL_DESIGN), published:toLegacyGlobalDesign(DEFAULT_GLOBAL_DESIGN) };
  record[field] = toLegacyGlobalDesign(value);
  await writeSetting("global_design",record);
}
async function readGlobalDesign(key) {
  await migrateLegacyGlobalDesign();
  return sanitizeStoredGlobalDesign(await readSetting(key,null) || DEFAULT_GLOBAL_DESIGN,key);
}
async function saveGlobalDesign(value) {
  const d=normalizeGlobalDesign(value);
  await writeSetting("global_design_draft",d);
  await writeLegacyGlobalDesignPart("draft",d);
  return d;
}

function validProductIds(ids,max=100){return Array.isArray(ids)&&ids.length<=max&&ids.every(id=>typeof id==="string"&&id.length>0&&id.length<=191)&&new Set(ids).size===ids.length}
function mapStorefrontProduct(row){const arr=value=>{try{const parsed=typeof value==="string"?JSON.parse(value):value;return Array.isArray(parsed)?parsed:[]}catch{return[]}};return{id:row.id,slug:row.slug,name:row.name,description:row.description||"",shortDescription:row.short_description||undefined,price:Number(row.price),...(row.compare_at_price==null?{}:{compareAtPrice:Number(row.compare_at_price)}),images:arr(row.images),categoryId:row.category_id||"",collectionSlugs:arr(row.collection_slugs),jewelleryType:row.jewellery_type||"necklace",stock:Number(row.stock),status:row.status,tags:arr(row.tags),createdAt:row.created_at?new Date(row.created_at).toISOString():new Date().toISOString()}}
async function productsForIds(ids,randomize=false){if(!Array.isArray(ids)||!ids.length)return[];const safeIds=ids.filter(id=>typeof id==="string").slice(0,100);if(!safeIds.length)return[];const placeholders=safeIds.map(()=>" ?".trim()).join(",");const [rows]=await pool.execute("SELECT * FROM products WHERE status='active' AND stock>0 AND id IN ("+placeholders+")",safeIds);const byId=new Map(rows.map(row=>[row.id,row]));const ordered=safeIds.map(id=>byId.get(id)).filter(Boolean);if(randomize){for(let i=ordered.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ordered[i],ordered[j]]=[ordered[j],ordered[i]]}}return ordered.map(mapStorefrontProduct)}
adminOnly.get("/homepage-layout",async(_req,res,next)=>{try{const draft=await readSetting("homepage_layout_draft",DEFAULT_LAYOUT);const published=await readSetting("homepage_layout_published",DEFAULT_LAYOUT);res.set("Cache-Control","no-store").json({draft,published})}catch(e){next(e)}});
adminOnly.put("/homepage-layout/draft",async(req,res,next)=>{try{const v=req.body;if(!v||v.version!==1||!Array.isArray(v.sections)||v.sections.length>40||v.sections.some(x=>!x||typeof x.id!=="string"||typeof x.enabled!=="boolean"||!Number.isInteger(x.sortOrder)))return res.status(400).json({error:"Invalid homepage layout."});await writeSetting("homepage_layout_draft",v);res.json({success:true,draft:v})}catch(e){next(e)}});
adminOnly.post("/homepage-layout/publish",async(_req,res,next)=>{try{const draft=await readSetting("homepage_layout_draft",DEFAULT_LAYOUT);await writeSetting("homepage_layout_published",draft);res.json({success:true,published:draft})}catch(e){next(e)}});
publicRouter.get("/homepage-layout",async(_req,res,next)=>{try{const layout=await readSetting("homepage_layout_published",DEFAULT_LAYOUT);res.set("Cache-Control","no-store").json({layout})}catch(e){next(e)}});
adminOnly.get("/curated-favourites",async(_req,res,next)=>{try{const draft=await readSetting("curated_favourites_draft",DEFAULT_CURATED);const published=await readSetting("curated_favourites_published",DEFAULT_CURATED);res.set("Cache-Control","no-store").json({draft,published,maxProducts:12})}catch(e){next(e)}});
adminOnly.put("/curated-favourites/draft",async(req,res,next)=>{try{const productIds=req.body?.productIds;if(!validProductIds(productIds,12))return res.status(400).json({error:"Choose up to 12 unique products."});const draft={version:1,productIds,configured:productIds.length>0};await writeSetting("curated_favourites_draft",draft);res.json({success:true,draft})}catch(e){next(e)}});
adminOnly.post("/curated-favourites/publish",async(_req,res,next)=>{try{const draft=await readSetting("curated_favourites_draft",DEFAULT_CURATED);await writeSetting("curated_favourites_published",draft);res.json({success:true,published:draft})}catch(e){next(e)}});
publicRouter.get("/curated-favourites",async(_req,res,next)=>{try{const config=await readSetting("curated_favourites_published",DEFAULT_CURATED);const products=await productsForIds(config.productIds||[]);res.set("Cache-Control","no-store").json({products,configured:config.configured===true&&products.length>0})}catch(e){next(e)}});
adminOnly.get("/explore-now",async(_req,res,next)=>{try{const draft=await readSetting("explore_now_draft",DEFAULT_EXPLORE);const published=await readSetting("explore_now_published",DEFAULT_EXPLORE);res.set("Cache-Control","no-store").json({draft,published,maxProducts:100})}catch(e){next(e)}});
adminOnly.put("/explore-now/draft",async(req,res,next)=>{try{const productIds=req.body?.productIds;const displayCount=Number(req.body?.displayCount);if(!validProductIds(productIds,100))return res.status(400).json({error:"Choose up to 100 unique eligible products."});if(!Number.isInteger(displayCount)||displayCount<2||displayCount>24)return res.status(400).json({error:"Display count must be between 2 and 24."});const draft={version:1,productIds,displayCount,configured:productIds.length>0};await writeSetting("explore_now_draft",draft);res.json({success:true,draft})}catch(e){next(e)}});
adminOnly.post("/explore-now/publish",async(_req,res,next)=>{try{const draft=await readSetting("explore_now_draft",DEFAULT_EXPLORE);await writeSetting("explore_now_published",draft);res.json({success:true,published:draft})}catch(e){next(e)}});
publicRouter.get("/explore-now",async(_req,res,next)=>{try{const config=await readSetting("explore_now_published",DEFAULT_EXPLORE);const products=config.configured===true?await productsForIds(config.productIds||[],true):[];const displayCount=Math.max(2,Math.min(24,Number(config.displayCount)||8));res.set("Cache-Control","no-store").json({products,displayCount,configured:config.configured===true&&products.length>0})}catch(e){next(e)}});


adminOnly.get("/storefront/design",async(_req,res,next)=>{try{const draft=await readGlobalDesign("global_design_draft");const published=await readGlobalDesign("global_design_published");res.set("Cache-Control","no-store").json({draft,published})}catch(e){next(e)}});
adminOnly.get("/design",async(_req,res,next)=>{try{const draft=await readGlobalDesign("global_design_draft");const published=await readGlobalDesign("global_design_published");res.set("Cache-Control","no-store").json({draft,published})}catch(e){next(e)}});
adminOnly.put("/storefront/design",async(req,res,next)=>{try{const value=req.body?.design;const invalid=validateGlobalDesign(value);if(invalid)return res.status(400).json({error:invalid});const draft=await saveGlobalDesign(value);res.set("Cache-Control","no-store").json({success:true,draft})}catch(e){next(e)}});
adminOnly.put("/design",async(req,res,next)=>{try{const value=req.body?.design;const invalid=validateGlobalDesign(value);if(invalid)return res.status(400).json({error:invalid});const draft=await saveGlobalDesign(value);res.set("Cache-Control","no-store").json({success:true,draft})}catch(e){next(e)}});
adminOnly.post("/storefront/design/publish",async(_req,res,next)=>{try{const published=await readGlobalDesign("global_design_draft");await writeSetting("global_design_published",published);
await writeLegacyGlobalDesignPart("published",published);res.set("Cache-Control","no-store").json({success:true,published})}catch(e){next(e)}});
adminOnly.post("/design/publish",async(_req,res,next)=>{try{const published=await readGlobalDesign("global_design_draft");await writeSetting("global_design_published",published);
await writeLegacyGlobalDesignPart("published",published);res.set("Cache-Control","no-store").json({success:true,published})}catch(e){next(e)}});
publicRouter.get("/storefront/design",async(_req,res,next)=>{try{const design=await readGlobalDesign("global_design_published");res.set("Cache-Control","no-store").json({design})}catch(e){next(e)}});
publicRouter.get("/design",async(_req,res,next)=>{try{const design=await readGlobalDesign("global_design_published");res.set("Cache-Control","no-store").json({design})}catch(e){next(e)}});

publicRouter.get("/banners", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT * FROM storefront_banners WHERE is_active=1 ORDER BY sort_order ASC, created_at ASC");
    res.set("Cache-Control", "no-store").json({ banners: rows.map(mapBanner) });
  } catch (error) { next(error); }
});
publicRouter.get("/announcement", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key='announcement' LIMIT 1");
    let announcement = { message: "", active: false, trustMessages: [] };
    if (rows.length) {
      try {
        const saved = JSON.parse(rows[0].setting_value);
        announcement = {
          message: typeof saved.message === "string" ? saved.message : "",
          active: saved.active === true,
          trustMessages: Array.isArray(saved.trustMessages)
            ? saved.trustMessages.slice(0, 3).map(item => String(item || "").trim().slice(0, 100))
            : []
        };
      } catch {}
    }
    res.set("Cache-Control", "no-store").json({ announcement });
  } catch (error) { next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicStorefrontRouter };
export default admin;
