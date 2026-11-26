import { pool } from "./db.js";

let migrationPromise;

/** Adds a backward-compatible admin ordering column; existing products retain data. */
export async function ensureProductSortOrderSchema() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sort_order' LIMIT 1"
      );
      if (!columns.length) {
        await pool.query("ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0");
      }
      const [indexes] = await pool.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_sort_order' LIMIT 1"
      );
      if (!indexes.length) {
        await pool.query("CREATE INDEX idx_products_sort_order ON products (sort_order, created_at)");
      }
    })().catch(error => { migrationPromise = null; throw error; });
  }
  return migrationPromise;
}
