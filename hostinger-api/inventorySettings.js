import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { DEFAULT_LOW_STOCK_THRESHOLD, validateLowStockThreshold } from "./inventorySettingsPolicy.js";

const router = Router();
router.use(requireAdminAuth);

let schemaReady;
async function ensureSettingsTable() {
  if (!schemaReady) {
    schemaReady = pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

export async function getLowStockThreshold() {
  await ensureSettingsTable();
  const [rows] = await pool.execute(
    "SELECT setting_value FROM storefront_settings WHERE setting_key = 'inventory_alert_threshold' LIMIT 1"
  );
  if (!rows.length) return DEFAULT_LOW_STOCK_THRESHOLD;
  const parsed = Number(rows[0].setting_value);
  return validateLowStockThreshold(parsed).valid ? parsed : DEFAULT_LOW_STOCK_THRESHOLD;
}

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    return res.json({ threshold: await getLowStockThreshold() });
  } catch (error) { return next(error); }
});

router.put("/", async (req, res, next) => {
  const result = validateLowStockThreshold(req.body?.threshold);
  if (!result.valid) return res.status(400).json({ error: result.error });
  try {
    await ensureSettingsTable();
    await pool.execute(
      "INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('inventory_alert_threshold', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [String(result.value)]
    );
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, threshold: result.value });
  } catch (error) { return next(error); }
});

export default router;
