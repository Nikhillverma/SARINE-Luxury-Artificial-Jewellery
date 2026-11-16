import { pool } from "./db.js";

const MIGRATION_KEY = "2026-11-16-mark-existing-orders-as-prelaunch-tests";

/**
 * Classify every order that exists at the first deployment of this migration
 * as pre-launch test data. This runs before the API starts listening, so no
 * post-deployment checkout can be swept into the one-time classification.
 *
 * Orders are retained unchanged for customer support and admin history.
 * New orders use the orders.is_test database default (0).
 */
export async function markExistingOrdersAsPrelaunchTests() {
  const connection = await pool.getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_schema_migrations (
        migration_key VARCHAR(190) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [appliedRows] = await connection.execute(
      "SELECT migration_key FROM app_schema_migrations WHERE migration_key = ? LIMIT 1",
      [MIGRATION_KEY]
    );

    if (appliedRows.length > 0) {
      return;
    }

    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'orders'
         AND COLUMN_NAME = 'is_test'
       LIMIT 1`
    );

    if (columns.length === 0) {
      await connection.query(
        "ALTER TABLE orders ADD COLUMN is_test TINYINT(1) NOT NULL DEFAULT 0"
      );
    }

    await connection.beginTransaction();

    // The storefront is still pre-launch: all rows present at this one-time
    // migration are test orders, regardless of payment method or status.
    await connection.query("UPDATE orders SET is_test = 1");

    await connection.execute(
      "INSERT INTO app_schema_migrations (migration_key, applied_at) VALUES (?, UTC_TIMESTAMP(3))",
      [MIGRATION_KEY]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
