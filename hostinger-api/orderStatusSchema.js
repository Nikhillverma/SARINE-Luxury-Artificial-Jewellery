import { pool } from "./db.js";

let migrationPromise;

// Keep order_status flexible as fulfilment stages evolve (e.g. packed).
// Existing enum values are preserved when converted to VARCHAR.
export async function ensureOrderStatusSchema() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const [columns] = await pool.execute(
        "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_status' LIMIT 1"
      );
      if (!columns.length) {
        throw new Error("The orders.order_status column is missing.");
      }
      const dataType = String(columns[0].DATA_TYPE || "").toLowerCase();
      if (dataType === "enum" || dataType === "set") {
        await pool.query("ALTER TABLE orders MODIFY COLUMN order_status VARCHAR(32) NOT NULL DEFAULT 'pending'");
      }
    })().catch(error => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}
