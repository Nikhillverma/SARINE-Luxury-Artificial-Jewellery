import { pool } from "./db.js";

export const SHIPPING_FLAT_FEE = 99;
export const FREE_SHIPPING_THRESHOLD = 1999;
export const COD_ENABLED = true;

export const DEFAULT_CHECKOUT_CONFIG = Object.freeze({
  shippingFlatFee: SHIPPING_FLAT_FEE,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  codEnabled: COD_ENABLED
});

let schemaPromise;
async function ensureSettingsSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.execute(
      "CREATE TABLE IF NOT EXISTS storefront_settings (" +
      "setting_key VARCHAR(100) NOT NULL PRIMARY KEY, " +
      "setting_value TEXT NOT NULL, " +
      "updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    ).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

function normalizeCheckoutConfig(value) {
  const input = value && typeof value === "object" ? value : {};
  const fee = Number(input.shippingFlatFee);
  const threshold = Number(input.freeShippingThreshold);
  return {
    shippingFlatFee: Number.isInteger(fee) && fee >= 0 && fee <= 5000
      ? fee : DEFAULT_CHECKOUT_CONFIG.shippingFlatFee,
    freeShippingThreshold: Number.isInteger(threshold) && threshold >= 1 && threshold <= 100000
      ? threshold : DEFAULT_CHECKOUT_CONFIG.freeShippingThreshold,
    codEnabled: typeof input.codEnabled === "boolean"
      ? input.codEnabled : DEFAULT_CHECKOUT_CONFIG.codEnabled
  };
}

export async function getCheckoutConfig() {
  await ensureSettingsSchema();
  const [rows] = await pool.execute(
    "SELECT setting_value FROM storefront_settings WHERE setting_key = 'checkout_config' LIMIT 1"
  );
  if (!rows.length) return { ...DEFAULT_CHECKOUT_CONFIG };
  try {
    return normalizeCheckoutConfig(JSON.parse(rows[0].setting_value));
  } catch {
    return { ...DEFAULT_CHECKOUT_CONFIG };
  }
}

export async function saveCheckoutConfig(value) {
  const input = value && typeof value === "object" ? value : {};
  const fee = Number(input.shippingFlatFee);
  const threshold = Number(input.freeShippingThreshold);
  if (!Number.isInteger(fee) || fee < 0 || fee > 5000) {
    throw new Error("Flat shipping fee must be a whole amount between ₹0 and ₹5,000.");
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100000) {
    throw new Error("Free-shipping threshold must be a whole amount between ₹1 and ₹1,00,000.");
  }
  if (typeof input.codEnabled !== "boolean") {
    throw new Error("Choose whether Cash on Delivery is enabled.");
  }
  const config = { shippingFlatFee: fee, freeShippingThreshold: threshold, codEnabled: input.codEnabled };
  await ensureSettingsSchema();
  await pool.execute(
    "INSERT INTO storefront_settings (setting_key, setting_value) VALUES ('checkout_config', ?) " +
    "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
    [JSON.stringify(config)]
  );
  return config;
}

export function calculateShippingFee(subtotal, config = DEFAULT_CHECKOUT_CONFIG) {
  const settings = normalizeCheckoutConfig(config);
  if (Number(subtotal) >= settings.freeShippingThreshold) return 0;
  return settings.shippingFlatFee;
}
