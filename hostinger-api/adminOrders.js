import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { canShipOrder, shouldRestoreStockOnCancellation } from "./orderAdminPolicy.js";
import { ensureInventoryTable, recordInventoryMovement } from "./inventoryLedger.js";

const router = Router();

// Enforce admin session authentication across all admin order routes
router.use(requireAdminAuth);

const ALLOWED_ACTIONS = ["mark_shipped", "mark_delivered", "cancel", "add_note"];

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

      const [itemRows] = await pool.query(
        `SELECT order_id, product_id, product_name, sku, unit_price, quantity, image
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
        unitPrice: Number(line.unit_price) || 0
      }));

      const note = row.admin_note || notesByOrderId[row.id] || undefined;

      return {
        orderNumber: row.order_number,
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
    if (action === "cancel") await ensureInventoryTable();

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

    // 2. Action: mark_shipped
    if (action === "mark_shipped") {
      if (order.refund_needed || order.order_status === "needs_refund") {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: "This order requires refund handling and cannot be shipped."
        });
      }

      if (!canShipOrder(order)) {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: "This order is not in a shippable state. Confirm payment or verify Cash on Delivery before shipping."
        });
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

    // 3. Action: mark_delivered
    if (action === "mark_delivered") {
      if (order.order_status !== "shipped") {
        await connection.rollback();
        connection.release();
        connection = null;
        return res.status(400).json({
          error: `Cannot mark as delivered: Order is currently "${order.order_status}". Orders must be marked "shipped" first.`
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
         VALUES (?, 'shipped', 'delivered', ?, ?, UTC_TIMESTAMP(3))`,
        [order.id, order.payment_method === "cod" ? "Delivered and COD collected" : "Delivered to recipient", adminEmail]
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

      if (currentStatus === "shipped" || currentStatus === "delivered") {
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

      if (!["pending", "placed", "confirmed", "awaiting_payment"].includes(currentStatus)) {
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
        const [lines] = await connection.execute(
          `SELECT product_id, SUM(quantity) AS quantity
           FROM order_items
           WHERE order_id = ? AND product_id IS NOT NULL
           GROUP BY product_id`,
          [order.id]
        );

        for (const line of lines) {
          const quantity = Number(line.quantity);
          if (!line.product_id || !Number.isSafeInteger(quantity) || quantity <= 0) continue;

          const [products] = await connection.execute(
            `SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE`,
            [line.product_id]
          );
          if (!products.length) continue;

          const product = products[0];
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
            productId: product.id,
            productName: product.name,
            previousStock,
            quantityDelta: quantity,
            newStock,
            reason: `Order cancellation restock ${cleanOrderNumber}`,
            actorId: req.admin?.id || "admin",
            actorName: req.admin?.name || adminEmail,
            actorEmail: adminEmail
          });
        }
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
