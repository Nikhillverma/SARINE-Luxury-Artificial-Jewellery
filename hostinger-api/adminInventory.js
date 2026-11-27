import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { ensureInventoryTable, recordInventoryMovement } from "./inventoryLedger.js";
import { ensureProductVariantSchema, syncProductVariantStock, recordVariantInventoryMovement } from "./productVariantSchema.js";
import { formatVariantLabel } from "./productVariantPolicy.js";
import { ensureOpeningStockSnapshots } from "./inventoryOpeningBalances.js";

const router = Router();
router.use(requireAdminAuth);

const REASONS = new Set([
  "Restock from Atelier",
  "Damaged / Inspection Pull",
  "Inventory Physical Reconciliation",
  "Customer Return Restored"
]);

// GET /api/admin/inventory/movements — searchable, paginated product + variant ledger.
router.get("/movements", async (req, res, next) => {
  try {
    await ensureInventoryTable();
    await ensureProductVariantSchema();
    await ensureOpeningStockSnapshots();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = String(req.query.search || "").trim().slice(0, 100);
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const conditions = [];
    const values = [];
    if (search) {
      conditions.push("(productName LIKE ? OR sku LIKE ? OR reason LIKE ? OR adminName LIKE ? OR adminEmail LIKE ? OR variantLabel LIKE ?)");
      const term = "%" + search.replace(/[!%_]/g, "!$&") + "%";
      values.push(term, term, term, term, term, term);
    }
    const toSqlUtc = (date, nextDay = false) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const parsed = new Date(date + "T00:00:00+05:30");
      if (!Number.isFinite(parsed.getTime())) return null;
      if (nextDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
      return parsed.toISOString().slice(0, 19).replace("T", " ");
    };
    if (from) {
      const boundary = toSqlUtc(from);
      if (!boundary) return res.status(400).json({ error: "Invalid movement start date." });
      conditions.push("createdAt >= ?");
      values.push(boundary);
    }
    if (to) {
      const boundary = toSqlUtc(to, true);
      if (!boundary) return res.status(400).json({ error: "Invalid movement end date." });
      conditions.push("createdAt < ?");
      values.push(boundary);
    }
    const union = `SELECT id, product_id AS productId, product_name AS productName, sku,
              admin_name AS adminName, admin_email AS adminEmail,
              previous_stock AS previousStock, quantity_delta AS quantityDelta,
              new_stock AS newStock, reason, created_at AS createdAt,
              'product' AS movementType, NULL AS variantLabel,
              cost_price_snapshot AS costPriceSnapshot,
              previous_stock_cost_value AS previousStockCostValue,
              new_stock_cost_value AS newStockCostValue
       FROM inventory_movements
       UNION ALL
       SELECT id, product_id AS productId, product_name AS productName, variant_sku AS sku,
              admin_name AS adminName, admin_email AS adminEmail,
              previous_stock AS previousStock, quantity_delta AS quantityDelta,
              new_stock AS newStock, reason, created_at AS createdAt,
              'variant' AS movementType, variant_label AS variantLabel,
              cost_price_snapshot AS costPriceSnapshot,
              previous_stock_cost_value AS previousStockCostValue,
              new_stock_cost_value AS newStockCostValue
       FROM variant_inventory_movements
       UNION ALL
       SELECT id, product_id AS productId, product_name AS productName, sku,
              'SARINE system' AS adminName, 'system@sarine.local' AS adminEmail,
              NULL AS previousStock, NULL AS quantityDelta,
              stock_on_hand AS newStock, 'Opening balance snapshot (migration)' AS reason,
              snapshot_at AS createdAt,
              'opening_balance' AS movementType, variant_label AS variantLabel,
              NULL AS costPriceSnapshot,
              NULL AS previousStockCostValue,
              NULL AS newStockCostValue
       FROM inventory_opening_balance_snapshots`;
    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM (${union}) AS movement_history${where}`,
      values
    );
    const [rows] = await pool.execute(
      `SELECT * FROM (${union}) AS movement_history${where}
       ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`,
      [...values, limit, (page - 1) * limit]
    );
    const total = Number(countRows[0]?.total || 0);
    res.set("Cache-Control", "no-store");
    return res.json({ movements: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { next(error); }
});

// GET /api/admin/inventory/reports — aggregate actual stock movements, excluding migration snapshots.
router.get("/reports", async (req, res, next) => {
  try {
    await ensureInventoryTable();
    await ensureProductVariantSchema();
    await ensureOpeningStockSnapshots();
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const toSqlUtc = (date, nextDay = false) => {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return null;
      const parsed = new Date(date + "T00:00:00+05:30");
      if (!Number.isFinite(parsed.getTime())) return null;
      if (nextDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
      return parsed.toISOString().slice(0, 19).replace("T", " ");
    };
    const conditions = [];
    const values = [];
    if (from) {
      const boundary = toSqlUtc(from);
      if (!boundary) return res.status(400).json({ error: "Invalid report start date." });
      conditions.push("createdAt >= ?");
      values.push(boundary);
    }
    if (to) {
      const boundary = toSqlUtc(to, true);
      if (!boundary) return res.status(400).json({ error: "Invalid report end date." });
      conditions.push("createdAt < ?");
      values.push(boundary);
    }
    const union = `SELECT product_id AS productId, product_name AS productName, sku,
              quantity_delta AS quantityDelta, reason, created_at AS createdAt,
              'product' AS movementType, NULL AS variantLabel
       FROM inventory_movements
       UNION ALL
       SELECT product_id AS productId, product_name AS productName, variant_sku AS sku,
              quantity_delta AS quantityDelta, reason, created_at AS createdAt,
              'variant' AS movementType, variant_label AS variantLabel
       FROM variant_inventory_movements`;
    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const [summaryRows] = await pool.execute(
      `SELECT COUNT(*) AS movementCount,
              COALESCE(SUM(CASE WHEN quantityDelta > 0 THEN quantityDelta ELSE 0 END), 0) AS stockInUnits,
              COALESCE(SUM(CASE WHEN quantityDelta < 0 THEN ABS(quantityDelta) ELSE 0 END), 0) AS stockOutUnits,
              COALESCE(SUM(quantityDelta), 0) AS netChange
       FROM (${union}) AS actual_movements${where}`,
      values
    );
    const categoryExpression = `CASE
      WHEN LOWER(reason) LIKE '%return%' THEN 'returns'
      WHEN LOWER(reason) REGEXP 'payment|checkout|order|sale' THEN 'sales'
      WHEN LOWER(reason) REGEXP 'restock|initial.*stock' THEN 'restocks'
      WHEN LOWER(reason) REGEXP 'damaged|inspection|reconciliation|adjust' THEN 'adjustments'
      ELSE 'other'
    END`;
    const [categoryRows] = await pool.execute(
      `SELECT ${categoryExpression} AS category, COUNT(*) AS movementCount,
              COALESCE(SUM(CASE WHEN quantityDelta > 0 THEN quantityDelta ELSE 0 END), 0) AS stockInUnits,
              COALESCE(SUM(CASE WHEN quantityDelta < 0 THEN ABS(quantityDelta) ELSE 0 END), 0) AS stockOutUnits
       FROM (${union}) AS actual_movements${where}
       GROUP BY category ORDER BY movementCount DESC, category ASC`,
      values
    );
    const [dailyRows] = await pool.execute(
      `SELECT DATE(DATE_ADD(createdAt, INTERVAL 330 MINUTE)) AS movementDate,
              COUNT(*) AS movementCount,
              COALESCE(SUM(CASE WHEN quantityDelta > 0 THEN quantityDelta ELSE 0 END), 0) AS stockInUnits,
              COALESCE(SUM(CASE WHEN quantityDelta < 0 THEN ABS(quantityDelta) ELSE 0 END), 0) AS stockOutUnits,
              COALESCE(SUM(quantityDelta), 0) AS netChange
       FROM (${union}) AS actual_movements${where}
       GROUP BY movementDate ORDER BY movementDate DESC`,
      values
    );
    const [productRows] = await pool.execute(
      `SELECT productId, productName, sku, movementType, variantLabel,
              COUNT(*) AS movementCount,
              COALESCE(SUM(CASE WHEN quantityDelta > 0 THEN quantityDelta ELSE 0 END), 0) AS stockInUnits,
              COALESCE(SUM(CASE WHEN quantityDelta < 0 THEN ABS(quantityDelta) ELSE 0 END), 0) AS stockOutUnits,
              COALESCE(SUM(quantityDelta), 0) AS netChange
       FROM (${union}) AS actual_movements${where}
       GROUP BY productId, productName, sku, movementType, variantLabel
       ORDER BY (stockInUnits + stockOutUnits) DESC, productName ASC`,
      values
    );
    const [reasonRows] = await pool.execute(
      `SELECT reason, COUNT(*) AS movementCount,
              COALESCE(SUM(CASE WHEN quantityDelta > 0 THEN quantityDelta ELSE 0 END), 0) AS stockInUnits,
              COALESCE(SUM(CASE WHEN quantityDelta < 0 THEN ABS(quantityDelta) ELSE 0 END), 0) AS stockOutUnits
       FROM (${union}) AS actual_movements${where}
       GROUP BY reason ORDER BY movementCount DESC, reason ASC`,
      values
    );
    const snapshotConditions = [];
    const snapshotValues = [];
    if (from) { snapshotConditions.push("snapshot_at >= ?"); snapshotValues.push(toSqlUtc(from)); }
    if (to) { snapshotConditions.push("snapshot_at < ?"); snapshotValues.push(toSqlUtc(to, true)); }
    const [snapshotRows] = await pool.execute(
      `SELECT COUNT(*) AS excludedSnapshots FROM inventory_opening_balance_snapshots${snapshotConditions.length ? " WHERE " + snapshotConditions.join(" AND ") : ""}`,
      snapshotValues
    );
    res.set("Cache-Control", "no-store");
    return res.json({
      summary: {
        movementCount: Number(summaryRows[0]?.movementCount || 0),
        stockInUnits: Number(summaryRows[0]?.stockInUnits || 0),
        stockOutUnits: Number(summaryRows[0]?.stockOutUnits || 0),
        netChange: Number(summaryRows[0]?.netChange || 0),
        excludedOpeningSnapshots: Number(snapshotRows[0]?.excludedSnapshots || 0)
      },
      categories: categoryRows.map(row => ({ ...row, movementCount: Number(row.movementCount), stockInUnits: Number(row.stockInUnits), stockOutUnits: Number(row.stockOutUnits) })),
      daily: dailyRows.map(row => ({ ...row, movementDate: row.movementDate, movementCount: Number(row.movementCount), stockInUnits: Number(row.stockInUnits), stockOutUnits: Number(row.stockOutUnits), netChange: Number(row.netChange) })),
      products: productRows.map(row => ({ ...row, movementCount: Number(row.movementCount), stockInUnits: Number(row.stockInUnits), stockOutUnits: Number(row.stockOutUnits), netChange: Number(row.netChange) })),
      reasons: reasonRows.map(row => ({ ...row, movementCount: Number(row.movementCount), stockInUnits: Number(row.stockInUnits), stockOutUnits: Number(row.stockOutUnits) })),
      filters: { from: from || null, to: to || null }
    });
  } catch (error) { next(error); }
});



router.get("/variants/movements", async (_req, res, next) => {
  try {
    await ensureProductVariantSchema();
    const productId = String(_req.query?.productId || "").trim();
    const where = productId ? "WHERE product_id = ?" : "";
    const [rows] = await pool.execute(
      `SELECT id, variant_id AS variantId, product_id AS productId, product_name AS productName,
              variant_sku AS variantSku, variant_label AS variantLabel, admin_name AS adminName,
              admin_email AS adminEmail, previous_stock AS previousStock,
              quantity_delta AS quantityDelta, new_stock AS newStock, reason, created_at AS createdAt
       FROM variant_inventory_movements ${where}
       ORDER BY created_at DESC, id DESC LIMIT 100`,
      productId ? [productId] : []
    );
    res.set("Cache-Control", "no-store");
    res.json({ movements: rows });
  } catch (error) { next(error); }
});

router.post("/variants/adjustments", async (req, res, next) => {
  const variantId = String(req.body?.variantId || "").trim();
  const delta = Number(req.body?.quantityDelta);
  const reason = String(req.body?.reason || "").trim();
  if (!variantId || variantId.length > 36) return res.status(400).json({ error: "Select a valid product variant." });
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 2147483647) {
    return res.status(400).json({ error: "Enter a non-zero whole-number stock adjustment." });
  }
  if (!REASONS.has(reason)) return res.status(400).json({ error: "Select a valid inventory adjustment reason." });

  let connection;
  try {
    await ensureProductVariantSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Resolve the parent ID without locking, then acquire locks parent-first
    // to match checkout, payment capture and order cancellation.
    const [variantRefs] = await connection.execute(
      "SELECT product_id FROM product_variants WHERE id = ? LIMIT 1",
      [variantId]
    );
    if (!variantRefs.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product variant not found." });
    }
    const productId = variantRefs[0].product_id;
    const [products] = await connection.execute(
      "SELECT id, name FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [productId]
    );
    if (!products.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Parent product not found for this variant." });
    }
    const [rows] = await connection.execute(
      "SELECT * FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE",
      [variantId, productId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product variant not found." });
    }
    const variant = { ...rows[0], product_name: products[0].name };
    const previousStock = Number(variant.stock);
    const newStock = previousStock + delta;
    if (!Number.isSafeInteger(newStock) || newStock < 0 || newStock > 2147483647) {
      await connection.rollback();
      return res.status(400).json({ error: "Adjustment would result in an invalid variant stock balance." });
    }
    await connection.execute(
      "UPDATE product_variants SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [newStock, variantId]
    );
    const productStock = await syncProductVariantStock(connection, variant.product_id);
    const movement = await recordVariantInventoryMovement(connection, {
      variantId, productId: variant.product_id, productName: variant.product_name,
      variantSku: variant.sku,
      variantLabel: formatVariantLabel(variant.option1_name, variant.option1_value, variant.option2_name, variant.option2_value),
      previousStock, quantityDelta: delta, newStock, reason,
      adminId: req.admin.id, adminName: req.admin.name || req.admin.email,
      adminEmail: req.admin.email
    });
    await connection.commit();
    res.set("Cache-Control", "no-store");
    return res.status(201).json({ movement, productStock });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    return next(error);
  } finally {
    connection?.release();
  }
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
    // Schema helpers may execute CREATE/ALTER TABLE, which implicitly commits
    // in MariaDB. Finish schema preparation before opening the stock transaction.
    await ensureProductVariantSchema();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // Lock the parent before checking its variant mode. Variant creation/editing
    // also locks this row, so the check cannot race with a variant being added.
    const [products] = await connection.execute(
      "SELECT id, name, stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [productId]
    );
    if (!products.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found." });
    }

    const [variantRows] = await connection.execute(
      "SELECT id FROM product_variants WHERE product_id = ? AND status = 'active' LIMIT 1 FOR UPDATE",
      [productId]
    );
    if (variantRows.length) {
      await connection.rollback();
      return res.status(400).json({ error: "This product uses variants. Adjust stock for the specific size or colour in Product Variants instead." });
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
