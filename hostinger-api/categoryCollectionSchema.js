import { pool } from "./db.js";

let migrationPromise;

/**
 * Adds a collection discriminator to categories. Existing categories are
 * deliberately backfilled as shared so no current storefront navigation or
 * product/category relationship is hidden by the migration.
 */
export async function ensureCategoryCollectionSchema() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'category_collection' LIMIT 1"
      );
      if (!columns.length) {
        await pool.query("ALTER TABLE categories ADD COLUMN category_collection VARCHAR(24) NOT NULL DEFAULT 'both'");
      }
      await pool.query("UPDATE categories SET category_collection = 'both' WHERE category_collection IS NULL OR category_collection = ''");
      const [indexes] = await pool.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND INDEX_NAME = 'idx_categories_collection_order' LIMIT 1"
      );
      if (!indexes.length) await pool.query("CREATE INDEX idx_categories_collection_order ON categories (category_collection, sort_order)");
    })().catch(error => { migrationPromise = null; throw error; });
  }
  return migrationPromise;
}
