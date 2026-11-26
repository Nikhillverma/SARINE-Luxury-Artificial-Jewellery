import { pool } from "./db.js";

let migrationPromise;

/**
 * Adds a nullable collection discriminator without assigning legacy products.
 * Existing records remain visible on the original Home page until reviewed.
 */
export async function ensureProductCollectionSchema() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'product_collection' LIMIT 1"
      );
      if (!columns.length) await pool.query("ALTER TABLE products ADD COLUMN product_collection VARCHAR(24) NULL");
      const [indexes] = await pool.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_product_collection_status' LIMIT 1"
      );
      if (!indexes.length) await pool.query("CREATE INDEX idx_products_product_collection_status ON products (product_collection, status)");
    })().catch(error => { migrationPromise = null; throw error; });
  }
  return migrationPromise;
}