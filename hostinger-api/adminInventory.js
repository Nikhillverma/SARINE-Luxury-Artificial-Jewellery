import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { ensureInventoryTable, recordInventoryMovement } from "./inventoryLedger.js";

const router = Router();
router.use(requireAdminAuth);

const REASONS = new Set([
  "Restock from Atelier",
  "Damaged / Inspection Pull",
  "Inventory Physical Reconciliation",
  "Customer Return Restored"
]);

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

    const movement = await recordInventoryMovement(connection, {
      productId: product.id,
      productName: product.name,
      previousStock,
      quantityDelta: delta,
      newStock,
      reason,
      actorId: req.admin.id,
      actorName: req.admin.name || req.admin.email,
      actorEmail: req.admin.email
    });

    await connection.commit();
    res.set("Cache-Control", "no-store");
    return res.status(201).json({ movement });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection?.release();
  }
});

export default router;
