import crypto from "node:crypto";
import { pool } from "./db.js";

let schemaPromise;

export async function ensureInventoryTable() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id CHAR(36) NOT NULL PRIMARY KEY,
        product_id VARCHAR(191) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        sku VARCHAR(191) NOT NULL,
        admin_id VARCHAR(191) NOT NULL,
        admin_name VARCHAR(255) NOT NULL,
        admin_email VARCHAR(254) NOT NULL,
        previous_stock INT UNSIGNED NOT NULL,
        quantity_delta INT NOT NULL,
        new_stock INT UNSIGNED NOT NULL,
        reason VARCHAR(100) NOT NULL,
        cost_price_snapshot DECIMAL(12,2) NULL,
        previous_stock_cost_value DECIMAL(14,2) NULL,
        new_stock_cost_value DECIMAL(14,2) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_inventory_movements_created (created_at),
        INDEX idx_inventory_movements_product (product_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const columns = [
        ["cost_price_snapshot", "DECIMAL(12,2) NULL"],
        ["previous_stock_cost_value", "DECIMAL(14,2) NULL"],
        ["new_stock_cost_value", "DECIMAL(14,2) NULL"]
      ];
      for (const [column, definition] of columns) {
        const [found] = await pool.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_movements' AND COLUMN_NAME = ? LIMIT 1",
          [column]
        );
        if (!found.length) await pool.query(`ALTER TABLE inventory_movements ADD COLUMN ${column} ${definition}`);
      }
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
}

export async function recordInventoryMovement(connection, {
  productId,
  productName,
  previousStock,
  quantityDelta,
  newStock,
  reason,
  actorId = "system",
  actorName = "SARINE system",
  actorEmail = "system@sarine.local"
}) {
  const [productRows] = await connection.execute(
    "SELECT cost_price FROM products WHERE id = ? LIMIT 1",
    [String(productId)]
  );
  const rawCostPrice = productRows[0]?.cost_price;
  const costPriceSnapshot = rawCostPrice == null ? null : Number(rawCostPrice);
  const hasCostSnapshot = Number.isFinite(costPriceSnapshot) && costPriceSnapshot >= 0;
  const movement = {
    id: crypto.randomUUID(),
    productId: String(productId),
    productName: String(productName || "Product"),
    sku: String(productId),
    adminName: String(actorName),
    adminEmail: String(actorEmail),
    previousStock: Number(previousStock),
    quantityDelta: Number(quantityDelta),
    newStock: Number(newStock),
    reason: String(reason).slice(0, 100),
    costPriceSnapshot: hasCostSnapshot ? costPriceSnapshot : null,
    previousStockCostValue: hasCostSnapshot ? Number((Number(previousStock) * costPriceSnapshot).toFixed(2)) : null,
    newStockCostValue: hasCostSnapshot ? Number((Number(newStock) * costPriceSnapshot).toFixed(2)) : null,
    createdAt: new Date().toISOString()
  };

  await connection.execute(
    `INSERT INTO inventory_movements
     (id, product_id, product_name, sku, admin_id, admin_name, admin_email,
      previous_stock, quantity_delta, new_stock, reason, cost_price_snapshot,
      previous_stock_cost_value, new_stock_cost_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      movement.id, movement.productId, movement.productName, movement.sku,
      String(actorId), movement.adminName, movement.adminEmail,
      movement.previousStock, movement.quantityDelta, movement.newStock,
      movement.reason, movement.costPriceSnapshot,
      movement.previousStockCostValue, movement.newStockCostValue
    ]
  );

  return movement;
}
