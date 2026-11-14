import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
const TARGET_TABLES = ["returns", "payment_events", "orders"];

// Temporary, admin-authenticated schema inspection. This endpoint reads
// INFORMATION_SCHEMA only and never reads or changes customer/order records.
router.get("/schema", requireAdminAuth, async (_req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const placeholders = TARGET_TABLES.map(() => "?").join(", ");
    const [columns] = await pool.execute(
      `SELECT
         TABLE_NAME,
         COLUMN_NAME,
         COLUMN_TYPE,
         IS_NULLABLE,
         COLUMN_KEY
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (${placeholders})
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      TARGET_TABLES
    );

    return res.json({
      readOnly: true,
      inspectedTables: TARGET_TABLES,
      columns
    });
  } catch (error) {
    console.error("Temporary schema diagnostics failed:", error.message);
    return res.status(500).json({
      error: "Unable to inspect database schema."
    });
  }
});

export default router;
