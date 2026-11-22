
import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const admin = Router();
const publicRouter = Router();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const blockTypes = new Set(["heading", "paragraph", "image", "button"]);

async function ensureSchema() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS cms_pages (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    draft_json LONGTEXT NOT NULL,
    published_json LONGTEXT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
function cleanPage(input) {
  if (!input || typeof input !== "object") throw new Error("Page data is required.");
  const str = (v, label, max, required = true) => {
    if (typeof v !== "string") throw new Error(label + " must be text.");
    const s = v.trim();
    if ((required && !s) || s.length > max) throw new Error(label + " is required and must be under " + max + " characters.");
    return s;
  };
  const slug = str(input.slug, "Slug", 120).toLowerCase();
  if (!slugPattern.test(slug) || ["admin","api","shop","product","pages","checkout","account","bag"].includes(slug)) throw new Error("Use a valid, available page slug.");
  if (!Array.isArray(input.blocks) || input.blocks.length > 40) throw new Error("A page can contain up to 40 content blocks.");
  const blocks = input.blocks.map((b, i) => {
    if (!b || !blockTypes.has(b.type)) throw new Error("Unsupported content block at position " + (i + 1) + ".");
    if (b.type === "image") {
      const src = str(b.src, "Image URL", 2048);
      if (!(src.startsWith("/") && !src.startsWith("//")) && !/^https:\/\//i.test(src)) throw new Error("Images must use a site path or HTTPS URL.");
      return { type: "image", src, alt: str(b.alt || "SARINE editorial image", "Image alt text", 180) };
    }
    if (b.type === "button") {
      const href = str(b.href, "Button destination", 500);
      if (!href.startsWith("/") || href.startsWith("//")) throw new Error("Buttons must link to an internal page.");
      return { type: "button", text: str(b.text, "Button label", 80), href };
    }
    return { type: b.type, text: str(b.text, "Block text", b.type === "heading" ? 180 : 3000) };
  });
  return {
    title: str(input.title, "Page title", 160),
    slug,
    seoTitle: str(input.seoTitle || input.title, "SEO title", 180),
    seoDescription: str(input.seoDescription || input.title, "SEO description", 320),
    blocks
  };
}
function parsePage(row, key = "draft_json") {
  try { return JSON.parse(row[key]); } catch { return null; }
}
admin.use(requireAdminAuth);
admin.get("/", async (_req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT id, slug, draft_json, published_json, is_published, updated_at FROM cms_pages ORDER BY updated_at DESC");
    res.set("Cache-Control", "no-store").json({ pages: rows.map(r => ({ id:r.id, slug:r.slug, draft:parsePage(r), published:parsePage(r,"published_json"), isPublished:Boolean(r.is_published), updatedAt:r.updated_at })) });
  } catch(e) { next(e); }
});
admin.post("/", async (req, res, next) => {
  try {
    await ensureSchema();
    const page = cleanPage(req.body);
    const id = crypto.randomUUID();
    await pool.execute("INSERT INTO cms_pages (id, slug, draft_json) VALUES (?, ?, ?)", [id, page.slug, JSON.stringify(page)]);
    res.status(201).set("Cache-Control","no-store").json({ success:true, page:{id, draft:page, isPublished:false} });
  } catch(e) { if (e.code === "ER_DUP_ENTRY") return res.status(409).json({error:"That page URL is already in use."}); if (/required|valid|under|block|internal|HTTPS|characters|available|text/i.test(e.message)) return res.status(400).json({error:e.message}); next(e); }
});
admin.put("/:id/draft", async (req, res, next) => {
  try {
    await ensureSchema();
    const page = cleanPage(req.body);
    const [result] = await pool.execute("UPDATE cms_pages SET slug=?, draft_json=? WHERE id=?", [page.slug, JSON.stringify(page), req.params.id]);
    if (!result.affectedRows) return res.status(404).json({error:"Page not found."});
    res.set("Cache-Control","no-store").json({success:true, draft:page});
  } catch(e) { if (e.code === "ER_DUP_ENTRY") return res.status(409).json({error:"That page URL is already in use."}); if (/required|valid|under|block|internal|HTTPS|characters|available|text/i.test(e.message)) return res.status(400).json({error:e.message}); next(e); }
});
admin.post("/:id/publish", async (req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT draft_json FROM cms_pages WHERE id=? LIMIT 1", [req.params.id]);
    if (!rows.length) return res.status(404).json({error:"Page not found."});
    const page = cleanPage(JSON.parse(rows[0].draft_json));
    await pool.execute("UPDATE cms_pages SET slug=?, published_json=?, is_published=1 WHERE id=?", [page.slug, JSON.stringify(page), req.params.id]);
    res.set("Cache-Control","no-store").json({success:true, published:page});
  } catch(e) { next(e); }
});
admin.post("/:id/unpublish", async (req,res,next) => {
  try { await ensureSchema(); const [result]=await pool.execute("UPDATE cms_pages SET is_published=0 WHERE id=?",[req.params.id]); if(!result.affectedRows) return res.status(404).json({error:"Page not found."}); res.json({success:true}); } catch(e){next(e);}
});
publicRouter.get("/:slug", async (req,res,next) => {
  try {
    await ensureSchema();
    const slug = String(req.params.slug || "").toLowerCase();
    if (!slugPattern.test(slug)) return res.status(404).json({error:"Page not found."});
    const [rows] = await pool.execute(`SELECT published_json FROM cms_pages WHERE JSON_UNQUOTE(JSON_EXTRACT(published_json, "$.slug"))=? AND is_published=1 LIMIT 1`, [slug]);
    if (!rows.length) return res.status(404).json({error:"Page not found."});
    const page = JSON.parse(rows[0].published_json);
    res.set("Cache-Control","public, max-age=60, stale-while-revalidate=300").json({page});
  } catch(e){next(e);}
});
export { publicRouter as publicCmsPagesRouter };
export default admin;
