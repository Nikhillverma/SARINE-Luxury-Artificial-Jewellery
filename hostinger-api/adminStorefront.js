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


const DEFAULT_LAYOUT={version:1,sections:["hero","categories","shop-by-gender","new-arrivals","best-sellers","curated-favourites","occasions","explore-now","price","our-story","editorial","care-guide","stay-in-touch"].map((id,sortOrder)=>({id,enabled:true,sortOrder}))};
const DEFAULT_SHOP_BY_GENDER={version:1,forHerImageUrl:"",forHimImageUrl:""};
const DEFAULT_CURATED={version:1,productIds:[],configured:false};
const DEFAULT_EXPLORE={version:1,productIds:[],displayCount:8,configured:false};
async function readSetting(key,fallback){await ensureSchema();const [rows]=await pool.execute("SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1",[key]);if(!rows.length)return fallback;try{return JSON.parse(rows[0].setting_value)}catch{return fallback}}
async function writeSetting(key,value){await ensureSchema();await pool.execute("INSERT INTO storefront_settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[key,JSON.stringify(value)])}
function validProductIds(ids,max=100){return Array.isArray(ids)&&ids.length<=max&&ids.every(id=>typeof id==="string"&&id.length>0&&id.length<=191)&&new Set(ids).size===ids.length}
function mapStorefrontProduct(row){const arr=value=>{try{const parsed=typeof value==="string"?JSON.parse(value):value;return Array.isArray(parsed)?parsed:[]}catch{return[]}};return{id:row.id,slug:row.slug,name:row.name,description:row.description||"",shortDescription:row.short_description||undefined,price:Number(row.price),...(row.compare_at_price==null?{}:{compareAtPrice:Number(row.compare_at_price)}),images:arr(row.images),categoryId:row.category_id||"",collectionSlugs:arr(row.collection_slugs),jewelleryType:row.jewellery_type||"necklace",stock:Number(row.stock),status:row.status,tags:arr(row.tags),createdAt:row.created_at?new Date(row.created_at).toISOString():new Date().toISOString()}}
async function productsForIds(ids,randomize=false){if(!Array.isArray(ids)||!ids.length)return[];const safeIds=ids.filter(id=>typeof id==="string").slice(0,100);if(!safeIds.length)return[];const placeholders=safeIds.map(()=>" ?".trim()).join(",");const [rows]=await pool.execute("SELECT * FROM products WHERE status='active' AND stock>0 AND id IN ("+placeholders+")",safeIds);const byId=new Map(rows.map(row=>[row.id,row]));const ordered=safeIds.map(id=>byId.get(id)).filter(Boolean);if(randomize){for(let i=ordered.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ordered[i],ordered[j]]=[ordered[j],ordered[i]]}}return ordered.map(mapStorefrontProduct)}
adminOnly.get("/shop-by-gender",async(_req,res,next)=>{try{const settings=await readSetting("shop_by_gender",DEFAULT_SHOP_BY_GENDER);res.set("Cache-Control","no-store").json({settings})}catch(e){next(e)}});
adminOnly.put("/shop-by-gender",async(req,res,next)=>{try{const input=req.body||{};const forHerImageUrl=String(input.forHerImageUrl||"").trim();const forHimImageUrl=String(input.forHimImageUrl||"").trim();const validUrl=value=>!value||(/^https:\/\//i.test(value)&&value.length<=2048);if(input.version!==1||!validUrl(forHerImageUrl)||!validUrl(forHimImageUrl))return res.status(400).json({error:"Provide valid HTTPS Hostinger image URLs for each tile."});const settings={version:1,forHerImageUrl,forHimImageUrl};await writeSetting("shop_by_gender",settings);res.set("Cache-Control","no-store").json({success:true,settings})}catch(e){next(e)}});
publicRouter.get("/shop-by-gender",async(_req,res,next)=>{try{const settings=await readSetting("shop_by_gender",DEFAULT_SHOP_BY_GENDER);res.set("Cache-Control","no-store").json({settings})}catch(e){next(e)}});

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
