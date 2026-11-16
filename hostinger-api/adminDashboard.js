import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { getLowStockThreshold } from "./inventorySettings.js";

const router = Router();

router.use(requireAdminAuth);

function parseJson(value, fallback = []) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIsoString(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const INITIAL_ORDER_HISTORY = `
  SELECT order_id, MIN(created_at) AS initial_created_at
  FROM order_status_history
  WHERE old_status IS NULL
    AND new_status IN ('placed', 'awaiting_payment')
  GROUP BY order_id
`;

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const lowStockThreshold = await getLowStockThreshold();
    const [orderRows, productRows, recentRows, lowStockRows] = await Promise.all([
      pool.execute(
        `SELECT
           (SELECT COUNT(*) FROM orders WHERE is_test = 1) AS test_orders,
           COUNT(*) AS orders,
           SUM(CASE WHEN o.order_status IN ('pending', 'awaiting_payment') THEN 1 ELSE 0 END) AS pending_orders,
           SUM(CASE WHEN o.order_status IN ('placed', 'confirmed', 'processing') THEN 1 ELSE 0 END) AS processing_orders,
           SUM(CASE WHEN o.order_status = 'shipped' THEN 1 ELSE 0 END) AS shipped_orders,
           SUM(CASE WHEN o.order_status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
           SUM(CASE WHEN o.order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
           SUM(CASE
             WHEN o.payment_status = 'paid'
               AND o.order_status NOT IN ('cancelled', 'returned', 'failed')
               AND (LOWER(COALESCE(o.payment_method, 'online')) <> 'cod' OR o.order_status = 'delivered')
             THEN GREATEST(COALESCE(o.total, 0) - COALESCE(o.refund_amount, 0), 0)
             ELSE 0
           END) AS paid_revenue,
           SUM(CASE
             WHEN DATE(DATE_ADD(COALESCE(o.created_at, initial_history.initial_created_at), INTERVAL 330 MINUTE))
                  = DATE(DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 330 MINUTE))
               AND o.payment_status = 'paid'
               AND o.order_status NOT IN ('cancelled', 'returned', 'failed')
               AND (LOWER(COALESCE(o.payment_method, 'online')) <> 'cod' OR o.order_status = 'delivered')
             THEN GREATEST(COALESCE(o.total, 0) - COALESCE(o.refund_amount, 0), 0)
             ELSE 0
           END) AS today_revenue,
           SUM(CASE
             WHEN DATE(DATE_ADD(COALESCE(o.created_at, initial_history.initial_created_at), INTERVAL 330 MINUTE))
                  = DATE(DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 330 MINUTE))
             THEN 1 ELSE 0
           END) AS today_orders
         FROM orders o
         LEFT JOIN (${INITIAL_ORDER_HISTORY}) AS initial_history
           ON initial_history.order_id COLLATE utf8mb4_unicode_ci = o.id COLLATE utf8mb4_unicode_ci
         WHERE o.is_test = 0`
      ),
      pool.execute(
        `SELECT
           COUNT(*) AS products,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_products,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_products,
           SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived_products,
           SUM(CASE WHEN status = 'active' AND stock <= COALESCE(alert.threshold, ?) THEN 1 ELSE 0 END) AS low_stock_products
         FROM products p
         LEFT JOIN product_inventory_alert_settings alert ON alert.product_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci`,
        [lowStockThreshold]
      ),
      pool.execute(
        `SELECT
           o.order_number, o.customer_name, o.total, o.payment_status, o.order_status,
           COALESCE(o.created_at, initial_history.initial_created_at) AS created_at
         FROM orders o
         LEFT JOIN (${INITIAL_ORDER_HISTORY}) AS initial_history
           ON initial_history.order_id COLLATE utf8mb4_unicode_ci = o.id COLLATE utf8mb4_unicode_ci
         ORDER BY COALESCE(o.created_at, initial_history.initial_created_at) DESC, o.id DESC
         LIMIT 5`
      ),
      pool.execute(
        `SELECT p.id, p.slug, p.name, p.stock, p.images,
           COALESCE(alert.threshold, ?) AS alert_threshold,
           (alert.product_id IS NOT NULL) AS has_custom_threshold
         FROM products p
         LEFT JOIN product_inventory_alert_settings alert ON alert.product_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
         WHERE p.status = 'active' AND p.stock <= COALESCE(alert.threshold, ?)
         ORDER BY p.stock ASC, p.updated_at DESC, p.name ASC
         LIMIT 5`,
        [lowStockThreshold, lowStockThreshold]
      )
    ]);

    const orderMetrics = orderRows[0][0] || {};
    const productMetrics = productRows[0][0] || {};

    return res.json({
      lowStockThreshold,
      metrics: {
        orders: Number(orderMetrics.orders) || 0,
        pendingOrders: Number(orderMetrics.pending_orders) || 0,
        processingOrders: Number(orderMetrics.processing_orders) || 0,
        shippedOrders: Number(orderMetrics.shipped_orders) || 0,
        deliveredOrders: Number(orderMetrics.delivered_orders) || 0,
        cancelledOrders: Number(orderMetrics.cancelled_orders) || 0,
        paidRevenue: Number(orderMetrics.paid_revenue) || 0,
        todayRevenue: Number(orderMetrics.today_revenue) || 0,
        todayOrders: Number(orderMetrics.today_orders) || 0,
        products: Number(productMetrics.products) || 0,
        activeProducts: Number(productMetrics.active_products) || 0,
        draftProducts: Number(productMetrics.draft_products) || 0,
        archivedProducts: Number(productMetrics.archived_products) || 0,
        lowStockProducts: Number(productMetrics.low_stock_products) || 0,
        testOrders: Number(orderMetrics.test_orders) || 0
      },
      recentOrders: recentRows[0].map(row => ({
        orderNumber: row.order_number,
        customerName: row.customer_name || "Guest customer",
        total: Number(row.total) || 0,
        paymentStatus: row.payment_status || "pending",
        orderStatus: row.order_status || "pending",
        createdAt: toIsoString(row.created_at)
      })),
      lowStockProducts: lowStockRows[0].map(row => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        stock: Number(row.stock) || 0,
        images: parseJson(row.images),
        alertThreshold: Number(row.alert_threshold),
        hasCustomThreshold: Boolean(row.has_custom_threshold)
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
