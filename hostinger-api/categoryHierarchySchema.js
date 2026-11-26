import { pool } from "./db.js";

let migrationPromise;

/**
 * Adds optional one-level parent relationships to categories.
 * Existing categories remain top-level; no category or product data is rewritten.
 */
export async function ensureCategoryHierarchySchema() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'parent_category_id' LIMIT 1"
      );
      if (!columns.length) {
        await pool.query("ALTER TABLE categories ADD COLUMN parent_category_id VARCHAR(64) NULL");
      }
      const [indexes] = await pool.execute(
        "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND INDEX_NAME = 'idx_categories_parent_order' LIMIT 1"
      );
      if (!indexes.length) {
        await pool.query("CREATE INDEX idx_categories_parent_order ON categories (parent_category_id, sort_order)");
      }
    })().catch(error => { migrationPromise = null; throw error; });
  }
  return migrationPromise;
}
