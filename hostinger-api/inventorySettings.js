import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { DEFAULT_LOW_STOCK_THRESHOLD, validateLowStockThreshold } from "./inventorySettingsPolicy.js";

const router = Router();
router.use(requireAdminAuth);

let schemaReady;
async function ensureSettingsTables() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.execute(`CREATE TABLE IF NOT EXISTS storefront_settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.execute(`CREATE TABLE IF NOT EXISTS product_inventory_alert_settings (
        product_id VARCHAR(64) NOT NULL PRIMARY KEY,
        threshold INT UNSIGNED NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX idx_product_inventory_alert_threshold (threshold)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

export async function getLowStockThreshold() {
  await ensureSettingsTables();
  const [rows] = await pool.execute(
    "SELECT setting_value FROM storefront_settings WHERE setting_key = 'inventory_alert_threshold' LIMIT 1"
  );
  if (!rows.length) return DEFAULT_LOW_STOCK_THRESHOLD;
  const parsed = Number(rows[0].setting_value);
  return validateLowStockThreshold(parsed).valid ? parsed : DEFAULT_LOW_STOCK_THRESHOLD;
}

export async function getProductLowStockThresholds() {
  await ensureSettingsTables();
  const [rows] = await pool.execute(
    "SELECT product_id, threshold FROM product_inventory_alert_settings"
  );
  return Object.fromEntries(rows.map(row => [String(row.product_id), Number(row.threshold)]));
}

export async function getEffectiveLowStockThreshold(productId, fallback) {
  await ensureSettingsTables();
  const [rows] = await pool.execute(
    "SELECT threshold FROM product_inventory_alert_settings WHERE product_id = ? LIMIT 1",
    [productId]
  );
  return rows.length ? Number(rows[0].threshold) : fallback;
}

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const [threshold, productThresholds] = await Promise.all([
      getLowStockThreshold(),
      getProductLowStockThresholds()
    ]);
    return res.json({ threshold, productThresholds });
  } catch (error) { return next(error); }
});

router.put("/", async (req, res, next) => {
  const result = validateLowStockThreshold(req.body?.threshold);
  if (!result.valid) return res.status(400).json({ error: result.error });
  try {
    await ensureSettingsTables();
    await pool.execute(
      "INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('inventory_alert_threshold', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [String(result.value)]
    );
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, threshold: result.value });
  } catch (error) { return next(error); }
});

router.put("/product/:productId", async (req, res, next) => {
  const productId = String(req.params.productId || "").trim();
  if (!productId || productId.length > 64) {
    return res.status(400).json({ error: "A valid product ID is required." });
  }
  const clearOverride = req.body?.threshold === null;
  const result = clearOverride ? null : validateLowStockThreshold(req.body?.threshold);
  if (!clearOverride && !result.valid) {
    return res.status(400).json({ error: result.error });
  }
  try {
    await ensureSettingsTables();
    const [products] = await pool.execute(
      "SELECT id FROM products WHERE id = ? LIMIT 1",
      [productId]
    );
    if (!products.length) return res.status(404).json({ error: "Product not found." });

    if (clearOverride) {
      await pool.execute(
        "DELETE FROM product_inventory_alert_settings WHERE product_id = ?",
        [productId]
      );
      return res.json({ success: true, productId, threshold: null, usesGlobalDefault: true });
    }

    await pool.execute(
      "INSERT INTO product_inventory_alert_settings (product_id, threshold) VALUES (?, ?) ON DUPLICATE KEY UPDATE threshold = VALUES(threshold)",
      [productId, result.value]
    );
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, productId, threshold: result.value, usesGlobalDefault: false });
  } catch (error) { return next(error); }
});

export default router;
