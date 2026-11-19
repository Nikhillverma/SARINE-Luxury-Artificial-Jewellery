import { pool } from "./db.js";

let migrationPromise;

export async function ensureProductVideoColumn() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const [columns] = await pool.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'product_video_url' LIMIT 1"
      );
      if (!columns.length) {
        await pool.query("ALTER TABLE products ADD COLUMN product_video_url VARCHAR(2048) NULL");
      }
    })().catch(error => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}
