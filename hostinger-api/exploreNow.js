import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { mapPublicProduct } from "./publicProductMapper.js";
import {
  EMPTY_EXPLORE_NOW,
  MAX_EXPLORE_PRODUCTS,
  validateExploreNow
} from "./exploreNowPolicy.js";

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

async function readExploreNow(key) {
  await ensureSchema();
  const [rows] = await pool.execute(
    "SELECT setting_value FROM storefront_settings WHERE setting_key=? LIMIT 1",
    [key]
  );
  if (!rows.length) return EMPTY_EXPLORE_NOW;
  try {
    return validateExploreNow(JSON.parse(rows[0].setting_value));
  } catch {
    return EMPTY_EXPLORE_NOW;
  }
}

async function writeExploreNow(key, config) {
  await ensureSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
    [key, JSON.stringify(config)]
  );
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

adminOnly.get("/", async (_req, res, next) => {
  try {
    const [draft, published] = await Promise.all([
      readExploreNow("explore_now_draft"),
      readExploreNow("explore_now_published")
    ]);
    res.set("Cache-Control", "no-store").json({
      draft,
      published,
      maxProducts: MAX_EXPLORE_PRODUCTS
    });
  } catch (error) { next(error); }
});

adminOnly.put("/draft", async (req, res, next) => {
  try {
    const draft = validateExploreNow(req.body);
    await writeExploreNow("explore_now_draft", draft);
    res.set("Cache-Control", "no-store").json({ success: true, draft });
  } catch (error) {
    if (error instanceof Error && /explore now|product|choose|valid|added|count/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

adminOnly.post("/publish", async (_req, res, next) => {
  try {
    const draft = await readExploreNow("explore_now_draft");
    await writeExploreNow("explore_now_published", draft);
    res.set("Cache-Control", "no-store").json({ success: true, published: draft });
  } catch (error) { next(error); }
});

publicRouter.get("/", async (_req, res, next) => {
  try {
    const config = await readExploreNow("explore_now_published");
    if (!config.configured || !config.productIds.length) {
      return res.set("Cache-Control", "no-store").json({
        products: [],
        displayCount: config.displayCount,
        configured: false
      });
    }
    const ids = config.productIds.slice(0, MAX_EXPLORE_PRODUCTS);
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT * FROM products WHERE id IN (${placeholders}) AND status='active' AND stock > 0`,
      ids
    );
    const products = shuffleInPlace(rows.map(mapPublicProduct));
    res.set("Cache-Control", "no-store").json({
      products,
      displayCount: Math.min(config.displayCount, products.length),
      configured: products.length > 0
    });
  } catch (error) { next(error); }
});

admin.use("/", adminOnly);
export { publicRouter as publicExploreNowRouter };
export default admin;
