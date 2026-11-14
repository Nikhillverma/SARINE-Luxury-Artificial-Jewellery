import crypto from "node:crypto";
import { pool } from "./db.js";

let schemaPromise;

export async function ensureInventoryTable() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
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
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_inventory_movements_created (created_at),
        INDEX idx_inventory_movements_product (product_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch((error) => {
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
    createdAt: new Date().toISOString()
  };

  await connection.execute(
    `INSERT INTO inventory_movements
     (id, product_id, product_name, sku, admin_id, admin_name, admin_email,
      previous_stock, quantity_delta, new_stock, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      movement.id, movement.productId, movement.productName, movement.sku,
      String(actorId), movement.adminName, movement.adminEmail,
      movement.previousStock, movement.quantityDelta, movement.newStock,
      movement.reason
    ]
  );

  return movement;
}
