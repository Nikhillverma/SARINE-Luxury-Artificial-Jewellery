import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { validateImageUpload } from "./mediaValidation.js";

let tableReady;

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

export const publicMediaRouter = Router();

publicMediaRouter.get("/:id", async (req, res, next) => {
  try {
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) {
      return res.status(404).end();
    }

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

adminMediaRouter.post("/", async (req, res, next) => {
  try {
    const { buffer, fileName, mimeType } = validateImageUpload(req.body || {});
    await ensureMediaTable();

    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO media_assets
       (id, file_name, mime_type, file_size, image_data, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, fileName, mimeType, buffer.length, buffer, String(req.admin?.id || "admin")]
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
