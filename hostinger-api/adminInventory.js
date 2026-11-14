import { Router } from "express";
import crypto from "node:crypto";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

const REASONS = new Set([
  "Restock from Atelier",
  "Damaged / Inspection Pull",
  "Inventory Physical Reconciliation",
  "Customer Return Restored"
]);

let tableReady;
function ensureInventoryTable() {
  if (!tableReady) {
    tableReady = pool.query(`
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
    `).catch(error => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

// GET /api/admin/inventory/movements — newest audited stock changes.
router.get("/movements", async (_req, res, next) => {
  try {
    await ensureInventoryTable();
    const [rows] = await pool.execute(
      `SELECT id, product_id AS productId, product_name AS productName, sku,
              admin_name AS adminName, admin_email AS adminEmail,
              previous_stock AS previousStock, quantity_delta AS quantityDelta,
              new_stock AS newStock, reason, created_at AS createdAt
       FROM inventory_movements
       ORDER BY created_at DESC, id DESC
       LIMIT 100`
    );
    res.set("Cache-Control", "no-store");
    return res.json({ movements: rows });
  } catch (error) { next(error); }
});

// POST /api/admin/inventory/adjustments — atomically update stock and write its audit record.
router.post("/adjustments", async (req, res, next) => {
  const productId = String(req.body?.productId || "").trim();
  const delta = Number(req.body?.quantityDelta);
  const reason = String(req.body?.reason || "").trim();

  if (!productId || productId.length > 191) {
    return res.status(400).json({ error: "Select a valid catalogue product." });
  }
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 2147483647) {
    return res.status(400).json({ error: "Enter a non-zero whole-number stock adjustment." });
  }
  if (!REASONS.has(reason)) {
    return res.status(400).json({ error: "Select a valid inventory adjustment reason." });
  }

  let connection;
  try {
    await ensureInventoryTable();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [products] = await connection.execute(
      "SELECT id, name, stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [productId]
    );
    if (!products.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found." });
    }

    const product = products[0];
    const previousStock = Number(product.stock);
    const newStock = previousStock + delta;
    if (!Number.isSafeInteger(newStock) || newStock < 0 || newStock > 2147483647) {
      await connection.rollback();
      return res.status(400).json({ error: "Adjustment would result in an invalid stock balance." });
    }

    await connection.execute(
      "UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [newStock, productId]
    );

    const movementId = crypto.randomUUID();
    await connection.execute(
      `INSERT INTO inventory_movements
       (id, product_id, product_name, sku, admin_id, admin_name, admin_email,
        previous_stock, quantity_delta, new_stock, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movementId, product.id, product.name, product.id,
        String(req.admin.id), String(req.admin.name || req.admin.email),
        String(req.admin.email), previousStock, delta, newStock, reason
      ]
    );

    await connection.commit();
    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      movement: {
        id: movementId, productId: product.id, productName: product.name,
        sku: product.id, adminName: req.admin.name || req.admin.email,
        adminEmail: req.admin.email, previousStock, quantityDelta: delta,
        newStock, reason, createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection?.release();
  }
});

export default router;
