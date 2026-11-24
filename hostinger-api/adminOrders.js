import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { canCancelOrder, canShipOrder, shouldRestoreStockOnCancellation } from "./orderAdminPolicy.js";
import { ensureInventoryTable, recordInventoryMovement } from "./inventoryLedger.js";
import { ensureProductVariantSchema, syncProductVariantStock, recordVariantInventoryMovement } from "./productVariantSchema.js";
import { formatVariantLabel } from "./productVariantPolicy.js";
import { ensureMarketingSchema, releaseCouponRedemptionForCancelledOrder } from "./marketingPolicy.js";

const router = Router();

// Enforce admin session authentication across all admin order routes
router.use(requireAdminAuth);

const ALLOWED_ACTIONS = ["mark_packed", "mark_shipped", "mark_out_for_delivery", "mark_delivered", "cancel", "add_note"];

let hasAdminNoteColumnCache = null;
async function checkAdminNoteColumn(conn) {
  if (hasAdminNoteColumnCache !== null) return hasAdminNoteColumnCache;
  try {
    const [cols] = await conn.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'admin_note'
       LIMIT 1`
    );
    hasAdminNoteColumnCache = Array.isArray(cols) && cols.length > 0;
  } catch {
    hasAdminNoteColumnCache = false;
  }
  return hasAdminNoteColumnCache;
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIsoString(dateVal) {
  if (dateVal === null || dateVal === undefined || dateVal === "") return undefined;
  const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * GET /api/admin/orders
 * Admin list orders with pagination and filtering.
 * Never returns public_token_hash or payment secrets.
 */
router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);

    const filterStatus = req.query.status ? String(req.query.status).trim() : "all";
    const filterPaymentStatus = req.query.paymentStatus ? String(req.query.paymentStatus).trim() : "all";
    const startAfter = req.query.startAfter ? String(req.query.startAfter).trim() : null;

    const conditions = [];
    const values = [];

    // Filter by order status
    if (filterStatus && filterStatus !== "all") {
      if (filterStatus === "pending") {
        conditions.push("(o.order_status = 'pending' OR o.order_status = 'awaiting_payment')");
      } else if (filterStatus === "needs_refund") {
        conditions.push("(o.order_status = 'needs_refund' OR o.refund_needed = 1)");
      } else {
        conditions.push("o.order_status = ?");
        values.push(filterStatus);
      }
    }

    // Filter by payment status
    if (filterPaymentStatus && filterPaymentStatus !== "all") {
      conditions.push("o.payment_status = ?");
      values.push(filterPaymentStatus);
    }

    // Keyset pagination cursor
    if (startAfter) {
      const [cursorRows] = await pool.execute(
        `SELECT created_at, id FROM orders WHERE order_number = ? OR id = ? LIMIT 1`,
        [startAfter, startAfter]
      );
      if (cursorRows.length > 0) {
        conditions.push("(o.created_at < ? OR (o.created_at = ? AND o.id < ?))");
        values.push(cursorRows[0].created_at, cursorRows[0].created_at, cursorRows[0].id);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Fetch limit + 1 to check if there is a next page
    const [rows] = await pool.execute(
      `SELECT
         o.id,
         o.order_number,
         o.customer_id,
         o.customer_name,
         o.customer_email,
         o.customer_phone,
         o.shipping_address,
         o.subtotal,
         o.shipping_fee,
         o.total,
         o.payment_method,
         o.payment_status,
         o.order_status,
         o.razorpay_payment_id,
         o.courier_name,
         o.tracking_number,
         o.tracking_url,
         o.shipped_at,
         o.delivered_at,
         o.cancelled_at,
         o.cancellation_reason,
         o.refund_needed,
         o.refund_amount,
         o.is_test,
         o.created_at,
         o.updated_at
       FROM orders o
       ${whereClause}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ?`,
      [...values, limit + 1]
    );

    let hasMore = false;
    let orderRows = rows;
    if (rows.length > limit) {
      hasMore = true;
      orderRows = rows.slice(0, limit);
    }

    const nextStartAfter = hasMore && orderRows.length > 0
      ? orderRows[orderRows.length - 1].order_number
      : null;

    // Fetch order line items if orders exist
    const itemsByOrderId = {};
    const notesByOrderId = {};

    if (orderRows.length > 0) {
      const orderIds = orderRows.map((r) => r.id);
      const placeholders = orderIds.map(() => "?").join(",");

      await ensureProductVariantSchema();
      const [itemRows] = await pool.query(
        `SELECT order_id, product_id, product_name, sku, unit_price, quantity, image,
                variant_id, variant_sku, variant_label, variant_options
         FROM order_items
         WHERE order_id IN (${placeholders})
         ORDER BY source_line ASC, id ASC`,
        orderIds
      );

      for (const item of itemRows) {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push(item);
      }

      // Fetch latest notes recorded in order_status_history
      const [historyRows] = await pool.query(
        `SELECT order_id, note
         FROM order_status_history
         WHERE order_id IN (${placeholders})
           AND note IS NOT NULL
           AND note != ''
         ORDER BY id ASC`,
        orderIds
      );

      for (const h of historyRows) {
        notesByOrderId[h.order_id] = h.note;
      }
    }

    const orders = orderRows.map((row) => {
      const shipping = parseJson(row.shipping_address, {});
      const lines = (itemsByOrderId[row.id] || []).map((line) => ({
        productId: line.product_id || "",
        name: line.product_name || "",
        image: line.image || "",
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.unit_price) || 0,
        sku: line.variant_sku || line.sku || undefined,
        variantId: line.variant_id || undefined,
        variantLabel: line.variant_label || undefined,
        variantOptions: parseJson(line.variant_options, undefined)
      }));

      const note = row.admin_note || notesByOrderId[row.id] || undefined;

      return {
        orderNumber: row.order_number,
        isTest: Boolean(row.is_test),
        createdAt: toIsoString(row.created_at),
        customer: {
          name: row.customer_name || shipping.fullName || "",
          email: row.customer_email || "",
          phone: row.customer_phone || shipping.phone || ""
        },
        shippingAddress: {
          fullName: shipping.fullName || row.customer_name || "",
          phone: shipping.phone || row.customer_phone || "",
          line1: shipping.line1 || "",
          line2: shipping.line2 || undefined,
          city: shipping.city || "",
          state: shipping.state || "",
          pincode: shipping.pincode || ""
        },
        lines,
        subtotal: Number(row.subtotal) || 0,
        shippingFee: Number(row.shipping_fee) || 0,
        total: Number(row.total) || 0,
        paymentMethod: row.payment_method || "online",
        paymentStatus: row.payment_status || "pending",
        orderStatus: row.order_status || "pending",
        razorpayPaymentId: row.razorpay_payment_id || undefined,
        courierName: row.courier_name || undefined,
        trackingNumber: row.tracking_number || undefined,
        trackingUrl: row.tracking_url || undefined,
        shippedAt: toIsoString(row.shipped_at),
        deliveredAt: toIsoString(row.delivered_at),
        adminNote: note,
        refundNeeded: Boolean(row.refund_needed || row.order_status === "needs_refund"),
        cancelledAt: toIsoString(row.cancelled_at),
        updatedAt: toIsoString(row.updated_at)
      };
    });

    return res.json({
      orders,
      count: orders.length,
      nextStartAfter
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/orders/test
 * Creates four synthetic COD test orders, one per published men's category.
 * These orders never touch inventory or payment gateways and are excluded
 * from revenue analytics by orders.is_test.
 */
router.post("/test", async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");
    const [schemaColumns] = await pool.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND COLUMN_NAME='is_test' LIMIT 1"
    );
    if (!schemaColumns.length) return res.status(503).json({ error: "Test-order classification is not available. Apply the order test migration first." });

    const [settingsRows] = await pool.execute(
      "SELECT setting_value FROM storefront_settings WHERE setting_key='men_storefront' LIMIT 1"
    );
    let categories = [];
    try {
      const record = settingsRows[0]?.setting_value ? JSON.parse(settingsRows[0].setting_value) : {};
      categories = Array.isArray(record.published?.categories) ? record.published.categories.filter(item => item?.active === true) : [];
    } catch {}
    if (!categories.length) {
      return res.status(400).json({ error: "Publish at least one men's category before generating test orders." });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO counters (counter_key, counter_value, updated_at) VALUES ('orders', 0, UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE counter_key=counter_key"
    );
    const [counterRows] = await connection.execute("SELECT counter_value FROM counters WHERE counter_key='orders' FOR UPDATE");
    const [maxRows] = await connection.execute(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(order_number,5) AS UNSIGNED)),0) AS max_seq FROM orders WHERE order_number LIKE 'SAR-%'"
    );
    let sequence = Math.max(Number(counterRows[0]?.counter_value || 0), Number(maxRows[0]?.max_seq || 0), 124);
    const created = [];
    const selectedCategories = categories.slice(0, 4);
    for (let index = 0; index < selectedCategories.length; index++) {
      const category = selectedCategories[index];
      let orderNumber;
      do {
        sequence += 1;
        orderNumber = `SAR-${String(sequence).padStart(6, "0")}`;
        const [exists] = await connection.execute("SELECT id FROM orders WHERE order_number=? LIMIT 1", [orderNumber]);
        if (!exists.length) break;
      } while (sequence < 999999999);
      const fullName = `SARINE Test Customer ${String(index + 1).padStart(2, "0")}`;
      const email = `sarine.test.customer.${String(index + 1).padStart(2, "0")}@example.invalid`;
      const phone = "0000000000";
      const line1 = "TEST ADDRESS — DO NOT SHIP";
      const city = "Kanpur";
      const state = "Uttar Pradesh";
      const pincode = "000000";
      const unitPrice = 1299 + index * 250;
      const shippingFee = unitPrice >= 1999 ? 0 : 99;
      const address = JSON.stringify({ fullName, phone, line1, line2: "Synthetic admin test data — no delivery", city, state, pincode });
      await connection.execute(
        `INSERT INTO orders (
          id, order_number, customer_id, customer_name, customer_email, customer_phone,
          shipping_address, subtotal, shipping_fee, total, coupon_code, discount_amount,
          payment_method, payment_status, order_status, public_token_hash, source_document,
          is_test, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 'cod', 'pending', 'placed', NULL, ?, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [orderNumber, orderNumber, fullName, email, phone, address, unitPrice, shippingFee, unitPrice + shippingFee,
         JSON.stringify({ source: "admin_test_order_generator", isTest: true, categoryId: String(category.id || "").slice(0,80) })]
      );
      const productName = `[TEST ONLY] SARINE Men — ${String(category.title || "Category").slice(0, 100)} sample piece`;
      await connection.execute(
        `INSERT INTO order_items
          (order_id, product_id, product_name, sku, unit_price, quantity, image, source_line, variant_id, variant_sku, variant_label, variant_options)
         VALUES (?, NULL, ?, ?, ?, 1, '', 0, NULL, NULL, NULL, NULL)`,
        [orderNumber, productName, `TEST-MEN-${String(category.id || index + 1).slice(0,32)}`, unitPrice]
      );
      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, NULL, 'placed', ?, ?, UTC_TIMESTAMP(3))`,
        [orderNumber, `TEST ORDER — synthetic customer and address; no payment, shipping or stock movement. Category: ${String(category.title || "Men's category").slice(0,100)}`, req.admin?.email || "admin"]
      );
      created.push({ orderNumber, category: String(category.title || "Men's category"), customer: fullName, email, phone, address: line1, city, state, pincode, subtotal: unitPrice, shippingFee, total: unitPrice + shippingFee, paymentMethod: "cod", paymentStatus: "pending", isTest: true });
    }
    await connection.execute("UPDATE counters SET counter_value=?, updated_at=UTC_TIMESTAMP(3) WHERE counter_key='orders'", [sequence]);
    await connection.commit();
    connection.release();
    connection = null;
    return res.status(201).json({ success: true, testOrders: created, count: created.length, note: "Synthetic test orders created. No inventory was changed and no payment gateway was called." });
  } catch (error) {
    if (connection) { await connection.rollback(); connection.release(); }
    next(error);
  }
});

/**
 * POST /api/admin/orders/update
 * Enforces business rules, transactions, and inventory restoration.
 */
router.post("/update", async (req, res, next) => {
  let connection;
  try {
    res.set("Cache-Control", "no-store");

    const {
      orderNumber,
      action,
      courierName,
      trackingNumber,
      trackingUrl,
      note,
      adminNote,
      cancellationReason
    } = req.body || {};

    if (!orderNumber || typeof orderNumber !== "string" || !/^SAR-\d{6}$/.test(orderNumber.trim())) {
      return res.status(400).json({
        error: "Invalid or missing order reference number (e.g. SAR-000125)."
      });
    }

    if (!action || typeof action !== "string" || !ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({
        error: `Invalid action "${action}". Allowed actions: ${ALLOWED_ACTIONS.join(", ")}.`
      });
    }

    const cleanOrderNumber = orderNumber.trim();
    const adminEmail = req.admin?.email || "admin";
    if (action === "cancel") {
      await ensureInventoryTable();
      await ensureMarketingSchema();
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orderRows] = await connection.execute(
      `SELECT * FROM orders WHERE order_number = ? FOR UPDATE`,
      [cleanOrderNumber]
    );

    if (!orderRows.length) {
      await connection.rollback();
      connection.release();
      connection = null;
      return res.status(404).json({ error: "We could not find the specified order." });
    }

    const order = orderRows[0];
    const nowIso = new Date().toISOString();

    // 1. Action: add_note
    if (action === "add_note") {
      const targetNote = typeof note === "string" ? note : typeof adminNote === "string" ? adminNote : "";
      const trimmedNote = targetNote.trim();

      if (trimmedNote.length > 500) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: "Admin note exceeds maximum length of 500 characters." });
      }

      const hasCol = await checkAdminNoteColumn(connection);
      if (hasCol) {
        await connection.execute(
          `UPDATE orders SET admin_note = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
          [trimmedNote, order.id]
        );
      } else {
        await connection.execute(
          `UPDATE orders SET updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
          [order.id]
        );
      }

      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [order.id, order.order_status, order.order_status, trimmedNote, adminEmail]
      );

      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: true,
        orderNumber: cleanOrderNumber,
        action: "add_note",
        adminNote: trimmedNote,
        updatedAt: nowIso
      });
    }

    // 2. Action: mark_packed — first physical fulfilment milestone.
    if (action === "mark_packed") {
      if (order.refund_needed || order.order_status === "needs_refund" || !canShipOrder(order)) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: "This order cannot be packed until payment is confirmed or COD is placed. Orders flagged for refund cannot be packed." });
      }
      if (!["placed", "confirmed", "processing"].includes(order.order_status)) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: "Only confirmed, unfulfilled orders can be marked packed." });
      }
      await connection.execute(
        "UPDATE orders SET order_status = 'packed', updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [order.id]
      );
      await connection.execute(
        "INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at) VALUES (?, ?, 'packed', 'Order packed and ready for dispatch', ?, UTC_TIMESTAMP(3))",
        [order.id, order.order_status, adminEmail]
      );
      await connection.commit();
      connection.release();
      connection = null;
      return res.json({ success: true, orderNumber: cleanOrderNumber, action: "mark_packed", orderStatus: "packed", updatedAt: nowIso });
    }

    // 3. Action: mark_shipped — only after packing is recorded.
    if (action === "mark_shipped") {
      if (order.refund_needed || order.order_status === "needs_refund") {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: "This order requires refund handling and cannot be shipped."
        });
      }

      if (order.order_status !== "packed") {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: "Mark the order as packed before dispatching it." });
      }

      const updateFields = ["order_status = 'shipped'", "shipped_at = UTC_TIMESTAMP(3)", "updated_at = UTC_TIMESTAMP(3)"];
      const updateValues = [];

      if (typeof courierName === "string" && courierName.trim()) {
        updateFields.push("courier_name = ?");
        updateValues.push(courierName.trim());
      }

      if (typeof trackingNumber === "string" && trackingNumber.trim()) {
        updateFields.push("tracking_number = ?");
        updateValues.push(trackingNumber.trim());
      }

      if (typeof trackingUrl === "string" && trackingUrl.trim()) {
        const cleanUrl = trackingUrl.trim();
        if (!cleanUrl.startsWith("https://")) {
          await connection.rollback();
          connection.release();
          connection = null;
          return res.status(400).json({ error: "Tracking URL must begin with https://" });
        }
        updateFields.push("tracking_url = ?");
        updateValues.push(cleanUrl);
      }

      updateValues.push(order.id);
      await connection.execute(
        `UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );

      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, ?, 'shipped', ?, ?, UTC_TIMESTAMP(3))`,
        [order.id, order.order_status, courierName ? `Shipped via ${courierName}` : "Marked shipped", adminEmail]
      );

      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: true,
        orderNumber: cleanOrderNumber,
        action: "mark_shipped",
        orderStatus: "shipped",
        shippedAt: nowIso,
        updatedAt: nowIso
      });
    }

    // 4. Action: mark_out_for_delivery — courier has the parcel for final delivery.
    if (action === "mark_out_for_delivery") {
      if (order.order_status !== "shipped") {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: "Only shipped orders can be marked out for delivery." });
      }
      await connection.execute(
        "UPDATE orders SET order_status = 'out_for_delivery', updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [order.id]
      );
      await connection.execute(
        "INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at) VALUES (?, 'shipped', 'out_for_delivery', 'Courier marked parcel out for delivery', ?, UTC_TIMESTAMP(3))",
        [order.id, adminEmail]
      );
      await connection.commit();
      connection.release();
      connection = null;
      return res.json({ success: true, orderNumber: cleanOrderNumber, action: "mark_out_for_delivery", orderStatus: "out_for_delivery", updatedAt: nowIso });
    }

    // 5. Action: mark_delivered
    if (action === "mark_delivered") {
      if (!["shipped", "out_for_delivery"].includes(order.order_status)) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: `Cannot mark as delivered: Order is currently "${order.order_status}". Orders must be shipped or out for delivery first.`
        });
      }

      const updateFields = ["order_status = 'delivered'", "delivered_at = UTC_TIMESTAMP(3)", "updated_at = UTC_TIMESTAMP(3)"];
      const updateValues = [];

      // For COD orders: update payment_status to 'paid' upon delivery (NEVER set razorpay_payment_id)
      if (order.payment_method === "cod") {
        updateFields.push("payment_status = 'paid'");
      }

      updateValues.push(order.id);
      await connection.execute(
        `UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );

      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, ?, 'delivered', ?, ?, UTC_TIMESTAMP(3))`,
        [order.id, order.order_status, order.payment_method === "cod" ? "Delivered and COD collected" : "Delivered to recipient", adminEmail]
      );

      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: true,
        orderNumber: cleanOrderNumber,
        action: "mark_delivered",
        orderStatus: "delivered",
        deliveredAt: nowIso,
        updatedAt: nowIso
      });
    }

    // 4. Action: cancel
    if (action === "cancel") {
      const currentStatus = order.order_status;

      if (["shipped", "out_for_delivery", "delivered"].includes(currentStatus)) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: "Cannot cancel an order that has already shipped or delivered."
        });
      }

      if (currentStatus === "cancelled") {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({ error: "Order is already cancelled." });
      }

      if (!canCancelOrder(order)) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: `Order cannot be cancelled in its current status ("${currentStatus}").`
        });
      }

      // Determine whether stock was decremented:
      // Stock is decremented for paid online orders and all COD orders (placed)
      const isPaid = order.payment_status === "paid";
      const stockWasDecremented = shouldRestoreStockOnCancellation(order);

      if (stockWasDecremented) {
        await ensureProductVariantSchema();
        const [lines] = await connection.execute(
          `SELECT product_id, variant_id, SUM(quantity) AS quantity
           FROM order_items
           WHERE order_id = ? AND product_id IS NOT NULL
           GROUP BY product_id, variant_id
           ORDER BY product_id ASC, variant_id ASC`,
          [order.id]
        );

        for (const line of lines) {
          const quantity = Number(line.quantity);
          if (!line.product_id || !Number.isSafeInteger(quantity) || quantity <= 0) continue;

          // Match checkout's lock order: parent product first, then its variant.
          // This serializes all variant stock changes for a product before the
          // aggregate parent stock is recalculated, avoiding stale totals.
          const [products] = await connection.execute(
            `SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE`,
            [line.product_id]
          );
          if (!products.length) {
            throw new Error(`Cannot restore inventory: product ${line.product_id} for order ${cleanOrderNumber} no longer exists.`);
          }
          const product = products[0];

          if (line.variant_id) {
            const [variants] = await connection.execute(
              `SELECT * FROM product_variants
               WHERE id = ? AND product_id = ? FOR UPDATE`,
              [line.variant_id, line.product_id]
            );
            if (!variants.length) {
              throw new Error(`Cannot restore inventory: variant ${line.variant_id} for order ${cleanOrderNumber} no longer exists.`);
            }
            const variant = variants[0];
            const previousStock = Number(variant.stock || 0);
            const newStock = previousStock + quantity;
            if (!Number.isSafeInteger(newStock) || newStock > 2147483647) {
              throw new Error("Variant stock restoration would exceed the supported inventory balance.");
            }
            await connection.execute(
              "UPDATE product_variants SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
              [newStock, line.variant_id]
            );
            await syncProductVariantStock(connection, line.product_id);
            await recordVariantInventoryMovement(connection, {
              variantId: line.variant_id, productId: line.product_id,
              productName: product.name, variantSku: variant.sku,
              variantLabel: formatVariantLabel(variant.option1_name, variant.option1_value, variant.option2_name, variant.option2_value),
              previousStock, quantityDelta: quantity, newStock,
              reason: `Order cancellation restock ${cleanOrderNumber}`,
              adminId: req.admin?.id || "admin", adminName: req.admin?.name || adminEmail,
              adminEmail
            });
            continue;
          }

          const previousStock = Number(product.stock || 0);
          const newStock = previousStock + quantity;
          if (!Number.isSafeInteger(newStock) || newStock > 2147483647) {
            throw new Error("Stock restoration would exceed the supported inventory balance.");
          }
          await connection.execute(
            `UPDATE products SET stock = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
            [newStock, line.product_id]
          );
          await recordInventoryMovement(connection, {
            productId: product.id, productName: product.name, previousStock,
            quantityDelta: quantity, newStock,
            reason: `Order cancellation restock ${cleanOrderNumber}`,
            actorId: req.admin?.id || "admin",
            actorName: req.admin?.name || adminEmail, actorEmail: adminEmail
          });
        }
      }

      // Release coupon capacity atomically with cancellation for reserved and redeemed uses.
      if (order.coupon_code) {
        await releaseCouponRedemptionForCancelledOrder(connection, order.order_number);
      }

      const reason = cancellationReason || (typeof note === "string" ? note : "Cancelled by atelier admin");

      const updateFields = [
        "order_status = 'cancelled'",
        "cancelled_at = UTC_TIMESTAMP(3)",
        "cancellation_reason = ?",
        "updated_at = UTC_TIMESTAMP(3)"
      ];
      const updateValues = [reason];

      if (isPaid) {
        updateFields.push("refund_needed = 1");
        updateFields.push("refund_amount = ?");
        updateValues.push(order.total);
      }

      updateValues.push(order.id);
      await connection.execute(
        `UPDATE orders SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );

      await connection.execute(
        `INSERT INTO order_status_history (order_id, old_status, new_status, note, changed_by, created_at)
         VALUES (?, ?, 'cancelled', ?, ?, UTC_TIMESTAMP(3))`,
        [order.id, currentStatus, reason, adminEmail]
      );

      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: true,
        orderNumber: cleanOrderNumber,
        action: "cancel",
        orderStatus: "cancelled",
        refundNeeded: isPaid,
        stockRestored: stockWasDecremented,
        cancelledAt: nowIso,
        updatedAt: nowIso
      });
    }

    await connection.rollback();
    connection.release();
    connection = null;
    return res.status(400).json({ error: "Unknown action." });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    next(error);
  }
});

export default router;
