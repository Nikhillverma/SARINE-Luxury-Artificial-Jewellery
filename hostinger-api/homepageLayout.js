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

async function writeSetting(key, value) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(value)]
  );
}

adminOnly.get("/", async (_req, res, next) => {
  try {
    const [draft, published] = await Promise.all([
      readSetting("homepage_layout_draft", DEFAULT_HOMEPAGE_LAYOUT),
      readSetting("homepage_layout_published", DEFAULT_HOMEPAGE_LAYOUT)
    ]);
    res.set("Cache-Control", "no-store").json({ draft, published });
  } catch (error) { next(error); }
});

adminOnly.put("/draft", async (req, res, next) => {
  try {
    const layout = validateHomepageLayout(req.body);
    await writeSetting("homepage_layout_draft", layout);
    res.set("Cache-Control", "no-store").json({ success: true, draft: layout });
  } catch (error) {
    if (error instanceof Error && /homepage|section|position|supported|duplicated|enabled|order|exactly once|cards per view/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

adminOnly.post("/publish", async (_req, res, next) => {
  try {
    const draft = await readSetting("homepage_layout_draft", DEFAULT_HOMEPAGE_LAYOUT);
    await writeSetting("homepage_layout_published", draft);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft });
  } catch (error) { next(error); }
});

publicRouter.get("/", async (_req, res, next) => {
  try {
    const layout = await readSetting("homepage_layout_published", DEFAULT_HOMEPAGE_LAYOUT);
    res.set("Cache-Control", "no-store").json({ layout });
  } catch (error) { next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicHomepageLayoutRouter };
export default admin;
