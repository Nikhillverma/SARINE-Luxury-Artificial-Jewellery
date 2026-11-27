import crypto from "node:crypto";
import { pool } from "./db.js";
import { formatVariantLabel } from "./productVariantPolicy.js";

const MIGRATION_KEY = "opening-stock-snapshot-v1";
const LOCK_NAME = "sarine-opening-stock-snapshot-v1";

export async function ensureOpeningStockSnapshots() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_opening_balance_snapshots (
      id CHAR(36) NOT NULL PRIMARY KEY,
      entity_type ENUM('product','variant') NOT NULL,
      entity_id VARCHAR(191) NOT NULL,
      product_id VARCHAR(191) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      sku VARCHAR(191) NOT NULL,
      variant_label VARCHAR(255) NULL,
      stock_on_hand INT UNSIGNED NOT NULL,
      snapshot_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_inventory_opening_entity (entity_type, entity_id),
      KEY idx_inventory_opening_snapshot_at (snapshot_at),
      KEY idx_inventory_opening_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_opening_balance_migrations (
      migration_key VARCHAR(100) NOT NULL PRIMARY KEY,
      completed_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const connection = await pool.getConnection();
  let lockAcquired = false;
  try {
    const [lockRows] = await connection.execute("SELECT GET_LOCK(?, 15) AS acquired", [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error("Could not acquire the opening-stock snapshot migration lock.");

    const [completed] = await connection.execute(
      "SELECT migration_key FROM inventory_opening_balance_migrations WHERE migration_key = ? LIMIT 1",
      [MIGRATION_KEY]
    );
    if (completed.length) return;

    await connection.beginTransaction();
    const [products] = await connection.execute(
      "SELECT id, name, stock FROM products ORDER BY id FOR UPDATE"
    );
    const [variants] = await connection.execute(
      `SELECT id, product_id, sku, option1_name, option1_value, option2_name, option2_value, stock
       FROM product_variants
       WHERE status = 'active'
       ORDER BY product_id, id
       FOR UPDATE`
    );

    const variantsByProduct = new Map();
    for (const variant of variants) {
      const list = variantsByProduct.get(variant.product_id) || [];
      list.push(variant);
      variantsByProduct.set(variant.product_id, list);
    }

    const snapshotSql = `INSERT IGNORE INTO inventory_opening_balance_snapshots
      (id, entity_type, entity_id, product_id, product_name, sku, variant_label, stock_on_hand, snapshot_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`;
    for (const product of products) {
      const productVariants = variantsByProduct.get(product.id) || [];
      if (productVariants.length) {
        for (const variant of productVariants) {
          await connection.execute(snapshotSql, [
            crypto.randomUUID(), "variant", String(variant.id), String(product.id),
            String(product.name || "Product"), String(variant.sku || variant.id),
            formatVariantLabel(variant.option1_name, variant.option1_value, variant.option2_name, variant.option2_value),
            Math.max(0, Number(variant.stock) || 0)
          ]);
        }
      } else {
        await connection.execute(snapshotSql, [
          crypto.randomUUID(), "product", String(product.id), String(product.id),
          String(product.name || "Product"), String(product.id), null,
          Math.max(0, Number(product.stock) || 0)
        ]);
      }
    }

    await connection.execute(
      "INSERT INTO inventory_opening_balance_migrations (migration_key, completed_at) VALUES (?, UTC_TIMESTAMP(3))",
      [MIGRATION_KEY]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    if (lockAcquired) {
      await connection.execute("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => {});
    }
    connection.release();
  }
}
