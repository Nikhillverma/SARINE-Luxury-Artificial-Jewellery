import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { validateImageUpload } from "./mediaValidation.js";

let tableReady;
let hashSchemaReady;

async function ensureMediaTable() {
  if (!tableReady) {
    tableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id CHAR(36) NOT NULL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(32) NOT NULL,
        file_size INT UNSIGNED NOT NULL,
        image_data MEDIUMBLOB NOT NULL,
        uploaded_by VARCHAR(255) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_media_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(error => {
      tableReady = undefined;
      throw error;
    });
  }
  await tableReady;
}

// Hashes are backfilled in small batches so existing media remains untouched and
// the first enhanced library request does not load every image into memory at once.
async function ensureMediaHashSchema() {
  if (!hashSchemaReady) {
    hashSchemaReady = (async () => {
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_assets' AND COLUMN_NAME = 'content_hash'"
      );
      if (!columns.length) {
        try {
          await pool.query("ALTER TABLE media_assets ADD COLUMN content_hash CHAR(64) NULL");
        } catch (error) {
          if (error.code !== "ER_DUP_FIELDNAME") throw error;
        }
      }

      const [indexes] = await pool.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_assets' AND INDEX_NAME = 'idx_media_content_hash'"
      );
      if (!indexes.length) {
        try {
          await pool.query("CREATE INDEX idx_media_content_hash ON media_assets (content_hash)");
        } catch (error) {
          if (error.code !== "ER_DUP_KEYNAME") throw error;
        }
      }

      while (true) {
        const [pending] = await pool.query(
          "SELECT id, image_data FROM media_assets WHERE content_hash IS NULL ORDER BY created_at ASC, id ASC LIMIT 20"
        );
        if (!pending.length) break;
        for (const row of pending) {
          const hash = crypto.createHash("sha256").update(Buffer.from(row.image_data)).digest("hex");
          await pool.execute("UPDATE media_assets SET content_hash = ? WHERE id = ? AND content_hash IS NULL", [hash, row.id]);
        }
      }
    })().catch(error => {
      hashSchemaReady = undefined;
      throw error;
    });
  }
  await hashSchemaReady;
}

let archiveSchemaReady;
async function ensureMediaArchiveSchema() {
  if (!archiveSchemaReady) {
    archiveSchemaReady = (async () => {
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_assets' AND COLUMN_NAME = 'archived_at'"
      );
      if (!columns.length) {
        try { await pool.query("ALTER TABLE media_assets ADD COLUMN archived_at DATETIME(3) NULL, ADD COLUMN archived_by VARCHAR(255) NULL"); }
        catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
      }
      const [indexes] = await pool.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_assets' AND INDEX_NAME = 'idx_media_archived_at' "
      );
      if (!indexes.length) {
        try { await pool.query("CREATE INDEX idx_media_archived_at ON media_assets (archived_at, created_at)"); }
        catch (error) { if (error.code !== "ER_DUP_KEYNAME") throw error; }
      }
    })().catch(error => { archiveSchemaReady = undefined; throw error; });
  }
  await archiveSchemaReady;
}

async function inspectMediaReferences(targetId) {
  const references = [];
  const warnings = [];
  const id = String(targetId).toLowerCase();
  const mediaPattern = /(?:^|\/)media\/([a-f0-9-]{36})(?=$|[?#])/ig;
  const scan = (value, source, location) => {
    if (typeof value === "string") {
      if (value.trim().toLowerCase() === id) references.push({ source, location });
      mediaPattern.lastIndex = 0;
      let match;
      while ((match = mediaPattern.exec(value)) !== null) {
        if (match[1].toLowerCase() === id) references.push({ source, location });
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((item, index) => scan(item, source, location + "[" + index + "]"));
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) scan(item, source, location + "." + key);
    }
  };
  const parse = value => { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return value; } };
  const hasTable = async table => {
    const [rows] = await pool.execute("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1", [table]);
    return rows.length > 0;
  };
  const source = async (table, label, callback) => {
    try {
      if (!(await hasTable(table))) { warnings.push(label + " table is not present"); return; }
      await callback();
    } catch (error) { warnings.push(label + " could not be fully scanned"); }
  };
  await source("products", "Product images", async () => {
    const [rows] = await pool.query("SELECT name, status, images FROM products");
    for (const row of rows) scan(parse(row.images), "Product", row.name + " (" + row.status + ")");
  });
  await source("categories", "Category images", async () => {
    const [rows] = await pool.query("SELECT name, image FROM categories WHERE image IS NOT NULL AND image <> ''");
    for (const row of rows) scan(row.image, "Category", row.name);
  });
  await source("storefront_banners", "Hero banners", async () => {
    const [rows] = await pool.query("SELECT title, image_url, is_active, product_collection FROM storefront_banners");
    for (const row of rows) scan(row.image_url, "Hero banner", row.title + " · " + (row.product_collection || "Shared") + " · " + (row.is_active ? "Published" : "Draft"));
  });
  await source("storefront_settings", "Storefront Studio settings", async () => {
    const [rows] = await pool.query("SELECT setting_key, setting_value FROM storefront_settings");
    for (const row of rows) scan(parse(row.setting_value), "Storefront setting", row.setting_key);
  });
  await source("cms_pages", "Website pages", async () => {
    const [rows] = await pool.query("SELECT slug, draft_json, published_json FROM cms_pages");
    for (const row of rows) {
      scan(parse(row.draft_json), "Website page", "/" + row.slug + " · Draft");
      scan(parse(row.published_json), "Website page", "/" + row.slug + " · Published");
    }
  });
  await source("cms_reusable_sections", "Reusable page sections", async () => {
    const [rows] = await pool.query("SELECT title, blocks_json FROM cms_reusable_sections");
    for (const row of rows) scan(parse(row.blocks_json), "Reusable page section", row.title);
  });
  return { references, warnings };
}

export const publicMediaRouter = Router();

publicMediaRouter.get("/:id", async (req, res, next) => {
  try {
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) return res.status(404).end();

    await ensureMediaTable();
    await ensureMediaArchiveSchema();
    const [rows] = await pool.execute(
      "SELECT mime_type, file_size, image_data FROM media_assets WHERE id = ? AND archived_at IS NULL LIMIT 1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).end();

    const image = rows[0];
    const data = Buffer.from(image.image_data);
    const etag = `"${crypto.createHash("sha256").update(data).digest("hex")}"`;
    res.set({
      "Content-Type": image.mime_type,
      "Content-Length": String(image.file_size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag
    });
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    return res.send(data);
  } catch (error) {
    next(error);
  }
});

export const adminMediaRouter = Router();
adminMediaRouter.use(requireAdminAuth);

// Group exact-content duplicates for safe, read-only inspection. No media rows are changed.
adminMediaRouter.get("/duplicates", async (req, res, next) => {
  try {
    await ensureMediaTable();
    await ensureMediaHashSchema();
    await ensureMediaArchiveSchema();

    const parsedLimit = Number.parseInt(String(req.query.limit || "20"), 10);
    const parsedOffset = Number.parseInt(String(req.query.offset || "0"), 10);
    const limit = Math.min(50, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 20));
    const offset = Math.min(100000, Math.max(0, Number.isFinite(parsedOffset) ? parsedOffset : 0));

    const [groups] = await pool.execute(
      `SELECT content_hash, COUNT(*) AS copies, MAX(created_at) AS latest_upload
       FROM media_assets
       WHERE content_hash IS NOT NULL
       GROUP BY content_hash
       HAVING COUNT(*) > 1
       ORDER BY latest_upload DESC, content_hash ASC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT content_hash FROM media_assets
         WHERE content_hash IS NOT NULL
         GROUP BY content_hash HAVING COUNT(*) > 1
       ) duplicate_groups`
    );

    const hashes = groups.map(group => group.content_hash);
    let files = [];
    if (hashes.length) {
      const placeholders = hashes.map(() => "?").join(",");
      const [rows] = await pool.execute(
        `SELECT id, content_hash, file_name, mime_type, file_size, uploaded_by, created_at
         FROM media_assets
         WHERE content_hash IN (${placeholders})
         ORDER BY content_hash ASC, created_at ASC, id ASC`,
        hashes
      );
      files = rows;
    }

    const byHash = new Map();
    for (const row of files) {
      const list = byHash.get(row.content_hash) || [];
      list.push({
        id: row.id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        size: Number(row.file_size),
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
        url: "/api/media/" + row.id
      });
      byHash.set(row.content_hash, list);
    }

    res.set("Cache-Control", "no-store").json({
      groups: groups.map(group => ({
        contentHash: group.content_hash,
        copies: Number(group.copies),
        latestUpload: group.latest_upload,
        media: byHash.get(group.content_hash) || []
      })),
      total: Number(countRows[0]?.total || 0),
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

// Read-only image usage map. References are propagated across exact SHA-256 duplicate files.
adminMediaRouter.get("/usage", async (req, res, next) => {
  try {
    await ensureMediaTable();
    await ensureMediaHashSchema();

    const parsedLimit = Number.parseInt(String(req.query.limit || "40"), 10);
    const parsedOffset = Number.parseInt(String(req.query.offset || "0"), 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 40));
    const offset = Math.min(100000, Math.max(0, Number.isFinite(parsedOffset) ? parsedOffset : 0));

    const [mediaRows] = await pool.execute(
      "SELECT id, file_name, mime_type, file_size, uploaded_by, created_at, content_hash FROM media_assets WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM media_assets WHERE archived_at IS NULL");
    const [allMediaRows] = await pool.query("SELECT id, content_hash FROM media_assets WHERE content_hash IS NOT NULL AND archived_at IS NULL");

    const hashById = new Map(allMediaRows.map(row => [String(row.id).toLowerCase(), row.content_hash]));
    const copiesByHash = new Map();
    for (const row of allMediaRows) {
      const list = copiesByHash.get(row.content_hash) || [];
      list.push(String(row.id).toLowerCase());
      copiesByHash.set(row.content_hash, list);
    }

    const referencesByHash = new Map();
    const referenceKeysByHash = new Map();
    const mediaIdPattern = /(?:^|\/)media\/([a-f0-9-]{36})(?=$|[?#])/ig;
    const addReference = (id, source, location) => {
      const hash = hashById.get(String(id).toLowerCase());
      if (!hash) return;
      const list = referencesByHash.get(hash) || [];
      const keys = referenceKeysByHash.get(hash) || new Set();
      const key = String(id).toLowerCase() + "|" + source + "|" + location;
      if (!keys.has(key) && list.length < 200) {
        keys.add(key);
        list.push({ source, location, matchedAssetId: String(id).toLowerCase() });
        referencesByHash.set(hash, list);
        referenceKeysByHash.set(hash, keys);
      }
    };
    const scanValue = (value, source, location = "") => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^[a-f0-9-]{36}$/i.test(trimmed)) addReference(trimmed, source, location || source);
        mediaIdPattern.lastIndex = 0;
        let match;
        while ((match = mediaIdPattern.exec(value)) !== null) addReference(match[1], source, location || source);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => scanValue(item, source, location ? location + "[" + index + "]" : "[" + index + "]"));
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) {
          scanValue(item, source, location ? location + "." + key : key);
        }
      }
    };
    const parseJson = value => {
      if (typeof value !== "string") return value;
      try { return JSON.parse(value); } catch { return value; }
    };
    const hasTable = async table => {
      const [rows] = await pool.execute(
        "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
        [table]
      );
      return rows.length > 0;
    };
    const coverage = [];
    const coverageWarnings = [];
    const scanSource = async (table, label, callback) => {
      try {
        if (!(await hasTable(table))) {
          coverageWarnings.push(label + " table is not present");
          return;
        }
        await callback();
        coverage.push(label);
      } catch (error) {
        coverageWarnings.push(label + " could not be fully scanned");
        console.warn("Image usage scan warning (" + label + "):", error.message);
      }
    };

    await scanSource("products", "Product images", async () => {
      const [rows] = await pool.query("SELECT id, name, status, images FROM products");
      for (const row of rows) {
        scanValue(parseJson(row.images), "Product", row.name + " (" + row.status + ")");
      }
    });

    await scanSource("categories", "Category images", async () => {
      const [rows] = await pool.query("SELECT name, image FROM categories WHERE image IS NOT NULL AND image <> ''");
      for (const row of rows) scanValue(row.image, "Category", row.name);
    });

    await scanSource("storefront_banners", "Hero banners", async () => {
      const [rows] = await pool.query("SELECT title, image_url, is_active, product_collection FROM storefront_banners");
      for (const row of rows) {
        scanValue(row.image_url, "Hero banner", row.title + " · " + (row.product_collection || "Shared") + " · " + (row.is_active ? "Published" : "Draft"));
      }
    });

    await scanSource("storefront_settings", "Storefront Studio settings", async () => {
      const [rows] = await pool.query("SELECT setting_key, setting_value FROM storefront_settings");
      const labelForSetting = key => {
        if (key.startsWith("homepage_content_")) return "Homepage content";
        if (key.startsWith("homepage_category_images")) return "Homepage category images";
        if (key.startsWith("shop_by_gender")) return "Shop by Gender";
        if (key.startsWith("shop_by_occasion")) return "Shop by Occasion";
        if (key.startsWith("homepage_layout_")) return "Homepage layout";
        if (key.startsWith("men_storefront")) return "SARINE Men storefront";
        if (key.startsWith("curated_favourites")) return "Curated favourites";
        if (key.startsWith("explore_now")) return "Explore Now";
        if (key.startsWith("editorial")) return "Editorial";
        if (key.startsWith("festival_campaigns")) return "Campaign content";
        return "Storefront setting";
      };
      for (const row of rows) {
        scanValue(parseJson(row.setting_value), labelForSetting(row.setting_key), row.setting_key);
      }
    });

    await scanSource("cms_pages", "Website pages (draft and published content)", async () => {
      const [rows] = await pool.query("SELECT slug, draft_json, published_json, is_published FROM cms_pages");
      for (const row of rows) {
        scanValue(parseJson(row.draft_json), "Website page", "/" + row.slug + " · Draft");
        if (row.published_json) {
          scanValue(parseJson(row.published_json), "Website page", "/" + row.slug + (row.is_published ? " · Published" : " · Previously published"));
        }
      }
    });

    await scanSource("cms_reusable_sections", "Reusable page sections", async () => {
      const [rows] = await pool.query("SELECT title, blocks_json FROM cms_reusable_sections");
      for (const row of rows) scanValue(parseJson(row.blocks_json), "Reusable page section", row.title);
    });

    const media = mediaRows.map(row => {
      const hash = row.content_hash;
      const references = hash ? (referencesByHash.get(hash) || []) : [];
      const duplicateCopies = hash ? (copiesByHash.get(hash) || []).length : 1;
      const directlyReferenced = references.some(reference => reference.matchedAssetId === String(row.id).toLowerCase());
      let usageStatus = "no-recorded-reference";
      if (directlyReferenced) usageStatus = "referenced";
      else if (references.length) usageStatus = "duplicate-in-use";
      else if (coverageWarnings.length) usageStatus = "needs-verification";
      return {
        id: row.id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        size: Number(row.file_size),
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
        url: "/api/media/" + row.id,
        contentHash: hash,
        duplicateCopies,
        usageCount: references.length,
        usageStatus,
        references: references.map(({ source, location }) => ({ source, location }))
      };
    });

    res.set("Cache-Control", "no-store").json({
      media,
      total: Number(countRows[0]?.total || 0),
      limit,
      offset,
      coverage,
      coverageWarnings,
      coverageComplete: coverageWarnings.length === 0,
      note: "Identical files share usage findings by exact SHA-256 content. No recorded reference is not proof that a file is safe to delete; verify any file before considering cleanup."
    });
  } catch (error) {
    next(error);
  }
});

// Return metadata only; image bytes remain served by the existing public media route.
adminMediaRouter.get("/", async (req, res, next) => {
  try {
    await ensureMediaTable();
    await ensureMediaHashSchema();

    const search = String(req.query.search || "").trim().slice(0, 120);
    const mimeType = String(req.query.mimeType || "").trim().toLowerCase();
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const requestedSort = String(req.query.sort || "newest");
    const sort = ["newest", "oldest", "filename"].includes(requestedSort) ? requestedSort : "newest";
    const parsedLimit = Number.parseInt(String(req.query.limit || "40"), 10);
    const parsedOffset = Number.parseInt(String(req.query.offset || "0"), 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 40));
    const offset = Math.min(100000, Math.max(0, Number.isFinite(parsedOffset) ? parsedOffset : 0));

    const validDate = value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!validDate(from) || !validDate(to) || (from && to && from > to)) {
      return res.status(400).json({ error: "Choose a valid upload date range." });
    }
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({ error: "Choose a supported image format." });
    }

    const conditions = ["archived_at IS NULL"];
    const params = [];
    if (search) { conditions.push("file_name LIKE ?"); params.push(`%${search}%`); }
    if (mimeType) { conditions.push("mime_type = ?"); params.push(mimeType); }
    if (from) { conditions.push("created_at >= ?"); params.push(`${from} 00:00:00`); }
    if (to) { conditions.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)"); params.push(`${to} 00:00:00`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = sort === "oldest" ? "created_at ASC, id ASC" : sort === "filename" ? "file_name ASC, id ASC" : "created_at DESC, id DESC";

    const [rows] = await pool.execute(
      `SELECT id, file_name, mime_type, file_size, uploaded_by, created_at, content_hash
       FROM media_assets ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM media_assets ${where}`,
      params
    );
    const [duplicateRows] = await pool.execute(
      "SELECT content_hash, COUNT(*) AS copies FROM media_assets WHERE content_hash IS NOT NULL AND archived_at IS NULL GROUP BY content_hash HAVING COUNT(*) > 1"
    );
    const duplicateCounts = new Map(duplicateRows.map(row => [row.content_hash, Number(row.copies)]));
    res.set("Cache-Control", "no-store").json({
      media: rows.map(row => ({
        id: row.id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        size: Number(row.file_size),
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
        duplicateCount: row.content_hash ? (duplicateCounts.get(row.content_hash) || 1) : 1,
        url: "/api/media/" + row.id
      })),
      total: Number(countRows[0]?.total || 0),
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});


// Recoverable archive. The image bytes remain in media_assets and can be restored by an admin.
adminMediaRouter.post("/:id/archive", async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = String(req.params.id || "").toLowerCase();
    const confirmation = String(req.body?.confirmFileName || "");
    if (!/^[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: "Invalid image ID." });
    await ensureMediaTable();
    await ensureMediaHashSchema();
    await ensureMediaArchiveSchema();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT id, file_name, content_hash, archived_at FROM media_assets WHERE id = ? FOR UPDATE",
      [id]
    );
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ error: "Image not found." }); }
    const asset = rows[0];
    if (asset.archived_at) { await connection.rollback(); return res.status(409).json({ error: "Image is already archived." }); }
    if (confirmation !== asset.file_name) { await connection.rollback(); return res.status(400).json({ error: "Filename confirmation does not match." }); }
    const [copies] = await connection.execute(
      "SELECT COUNT(*) AS copies FROM media_assets WHERE content_hash = ? AND archived_at IS NULL",
      [asset.content_hash]
    );
    if (Number(copies[0]?.copies || 0) !== 1) { await connection.rollback(); return res.status(409).json({ error: "This image has identical copies. Review the duplicate group first." }); }
    const scan = await inspectMediaReferences(id);
    if (scan.warnings.length) { await connection.rollback(); return res.status(409).json({ error: "Archive blocked because not all tracked sources could be scanned.", coverageWarnings: scan.warnings }); }
    if (scan.references.length) { await connection.rollback(); return res.status(409).json({ error: "Archive blocked because the image is still referenced.", references: scan.references }); }
    const [updated] = await connection.execute(
      "UPDATE media_assets SET archived_at = CURRENT_TIMESTAMP(3), archived_by = ? WHERE id = ? AND archived_at IS NULL",
      [String(req.admin?.id || "admin"), id]
    );
    if (!updated.affectedRows) { await connection.rollback(); return res.status(409).json({ error: "The image changed during review. Refresh and try again." }); }
    await connection.commit();
    return res.json({ success: true, archived: true, recoverable: true, id, fileName: asset.file_name });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return next(error);
  } finally { connection.release(); }
});

adminMediaRouter.get("/archived", async (req, res, next) => {
  try {
    await ensureMediaTable();
    await ensureMediaArchiveSchema();
    const [rows] = await pool.execute(
      "SELECT id, file_name, mime_type, file_size, uploaded_by, created_at, archived_at, archived_by FROM media_assets WHERE archived_at IS NOT NULL ORDER BY archived_at DESC LIMIT 100"
    );
    res.set("Cache-Control", "no-store").json({ media: rows.map(row => ({
      id: row.id, fileName: row.file_name, mimeType: row.mime_type, size: Number(row.file_size),
      uploadedBy: row.uploaded_by, createdAt: row.created_at, archivedAt: row.archived_at,
      archivedBy: row.archived_by
    })) });
  } catch (error) { next(error); }
});

adminMediaRouter.post("/:id/restore", async (req, res, next) => {
  try {
    const id = String(req.params.id || "").toLowerCase();
    if (!/^[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: "Invalid image ID." });
    await ensureMediaTable();
    await ensureMediaArchiveSchema();
    const [result] = await pool.execute(
      "UPDATE media_assets SET archived_at = NULL, archived_by = NULL WHERE id = ? AND archived_at IS NOT NULL",
      [id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Archived image not found." });
    return res.json({ success: true, restored: true, id });
  } catch (error) { return next(error); }
});

adminMediaRouter.post("/", async (req, res, next) => {
  try {
    const { buffer, fileName, mimeType } = validateImageUpload(req.body || {});
    await ensureMediaTable();
    await ensureMediaHashSchema();

    const id = crypto.randomUUID();
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
    await pool.execute(
      `INSERT INTO media_assets
       (id, file_name, mime_type, file_size, image_data, uploaded_by, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, fileName, mimeType, buffer.length, buffer, String(req.admin?.id || "admin"), contentHash]
    );

    return res.status(201).json({
      success: true,
      media: {
        id,
        fileName,
        mimeType,
        size: buffer.length,
        url: `/api/media/${id}`
      }
    });
  } catch (error) {
    if (error.message?.includes("image") || error.message?.includes("filename") || error.message?.includes("JPEG") || error.message?.includes("2 MB")) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});
