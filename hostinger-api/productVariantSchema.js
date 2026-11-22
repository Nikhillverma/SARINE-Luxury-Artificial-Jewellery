import crypto from "node:crypto";
import { pool } from "./db.js";
import { formatVariantLabel } from "./productVariantPolicy.js";

let schemaPromise;

export async function ensureProductVariantSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id CHAR(36) NOT NULL PRIMARY KEY,
          product_id VARCHAR(191) NOT NULL,
          option1_name VARCHAR(60) NOT NULL,
          option1_value VARCHAR(100) NOT NULL,
          option2_name VARCHAR(60) NULL,
          option2_value VARCHAR(100) NULL,
          sku VARCHAR(100) NOT NULL,
          price DECIMAL(10,2) NULL,
          compare_at_price DECIMAL(10,2) NULL,
          stock INT UNSIGNED NOT NULL DEFAULT 0,
          status ENUM('active','inactive') NOT NULL DEFAULT 'active',
          sort_order INT NOT NULL DEFAULT 0,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          UNIQUE KEY uq_product_variants_sku (sku),
          KEY idx_product_variants_product_status (product_id, status, sort_order),
          KEY idx_product_variants_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS variant_inventory_movements (
          id CHAR(36) NOT NULL PRIMARY KEY,
          variant_id CHAR(36) NOT NULL,
          product_id VARCHAR(191) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          variant_sku VARCHAR(100) NOT NULL,
          variant_label VARCHAR(255) NOT NULL,
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
          KEY idx_variant_inventory_created (created_at),
          KEY idx_variant_inventory_variant (variant_id),
          KEY idx_variant_inventory_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      const movementColumns = [
        ["cost_price_snapshot", "DECIMAL(12,2) NULL"],
        ["previous_stock_cost_value", "DECIMAL(14,2) NULL"],
        ["new_stock_cost_value", "DECIMAL(14,2) NULL"]
      ];
      for (const [column, definition] of movementColumns) {
        const [found] = await pool.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'variant_inventory_movements' AND COLUMN_NAME = ? LIMIT 1",
          [column]
        );
        if (!found.length) await pool.query(`ALTER TABLE variant_inventory_movements ADD COLUMN ${column} ${definition}`);
      }

      const requiredColumns = [
        ["variant_id", "CHAR(36) NULL"],
        ["variant_sku", "VARCHAR(100) NULL"],
        ["variant_label", "VARCHAR(255) NULL"],
        ["variant_options", "JSON NULL"]
      ];
      for (const [column, definition] of requiredColumns) {
        const [found] = await pool.execute(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = ? LIMIT 1",
          [column]
        );
        if (!found.length) {
          await pool.query(`ALTER TABLE order_items ADD COLUMN ${column} ${definition}`);
        }
      }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export function mapVariant(row) {
  return {
    id: row.id,
    productId: row.product_id,
    option1Name: row.option1_name,
    option1Value: row.option1_value,
    option2Name: row.option2_name || undefined,
    option2Value: row.option2_value || undefined,
    label: formatVariantLabel(row.option1_name, row.option1_value, row.option2_name, row.option2_value),
    sku: row.sku,
    price: row.price == null ? undefined : Number(row.price),
    compareAtPrice: row.compare_at_price == null ? undefined : Number(row.compare_at_price),
    stock: Number(row.stock),
    status: row.status,
    sortOrder: Number(row.sort_order || 0)
  };
}

export async function getProductVariants(productIds, { activeOnly = true } = {}) {
  await ensureProductVariantSchema();
  const ids = [...new Set((Array.isArray(productIds) ? productIds : [productIds]).filter(Boolean))];
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const conditions = activeOnly ? " AND status = 'active'" : "";
  const [rows] = await pool.execute(
    `SELECT * FROM product_variants WHERE product_id IN (${placeholders})${conditions} ORDER BY sort_order ASC, option1_value ASC, option2_value ASC`,
    ids
  );
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.product_id) || [];
    list.push(mapVariant(row));
    grouped.set(row.product_id, list);
  }
  return grouped;
}

export async function syncProductVariantStock(connection, productId) {
  const [rows] = await connection.execute(
    "SELECT COALESCE(SUM(stock), 0) AS total FROM product_variants WHERE product_id = ? AND status = 'active'",
    [productId]
  );
  const total = Number(rows[0]?.total || 0);
  await connection.execute(
    "UPDATE products SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
    [total, productId]
  );
  return total;
}

export async function recordVariantInventoryMovement(connection, {
  variantId, productId, productName, variantSku, variantLabel,
  previousStock, quantityDelta, newStock, reason,
  adminId = "system", adminName = "SARINE system", adminEmail = "system@sarine.local"
}) {
  const [productRows] = await connection.execute(
    "SELECT cost_price FROM products WHERE id = ? LIMIT 1",
    [productId]
  );
  const rawCostPrice = productRows[0]?.cost_price;
  const costPriceSnapshot = rawCostPrice == null ? null : Number(rawCostPrice);
  const hasCostSnapshot = Number.isFinite(costPriceSnapshot) && costPriceSnapshot >= 0;
  const movement = {
    id: crypto.randomUUID(),
    variantId,
    productId,
    productName,
    variantSku,
    variantLabel,
    adminId: String(adminId),
    adminName: String(adminName),
    adminEmail: String(adminEmail),
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
    `INSERT INTO variant_inventory_movements
      (id, variant_id, product_id, product_name, variant_sku, variant_label,
       admin_id, admin_name, admin_email, previous_stock, quantity_delta, new_stock, reason,
       cost_price_snapshot, previous_stock_cost_value, new_stock_cost_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [movement.id, movement.variantId, movement.productId, movement.productName,
     movement.variantSku, movement.variantLabel, movement.adminId, movement.adminName,
     movement.adminEmail, movement.previousStock, movement.quantityDelta,
     movement.newStock, movement.reason]
  );
  return movement;
}
