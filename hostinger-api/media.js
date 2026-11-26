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

export const publicMediaRouter = Router();

publicMediaRouter.get("/:id", async (req, res, next) => {
  try {
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) return res.status(404).end();

    await ensureMediaTable();
    const [rows] = await pool.execute(
      "SELECT mime_type, file_size, image_data FROM media_assets WHERE id = ? LIMIT 1",
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

    const conditions = [];
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
      "SELECT content_hash, COUNT(*) AS copies FROM media_assets WHERE content_hash IS NOT NULL GROUP BY content_hash HAVING COUNT(*) > 1"
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
