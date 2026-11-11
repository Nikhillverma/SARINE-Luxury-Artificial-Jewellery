import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

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

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const [orderRows, productRows, recentRows, lowStockRows] = await Promise.all([
      pool.execute(
        `SELECT
           COUNT(*) AS orders,
           SUM(CASE WHEN order_status IN ('pending', 'awaiting_payment') THEN 1 ELSE 0 END) AS pending_orders,
           SUM(CASE WHEN order_status IN ('placed', 'confirmed', 'processing') THEN 1 ELSE 0 END) AS processing_orders,
           SUM(CASE WHEN order_status = 'shipped' THEN 1 ELSE 0 END) AS shipped_orders,
           SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
           SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
           SUM(CASE
             WHEN payment_status = 'paid'
               AND order_status NOT IN ('cancelled', 'returned', 'failed')
               AND (LOWER(COALESCE(payment_method, 'online')) <> 'cod' OR order_status = 'delivered')
             THEN GREATEST(COALESCE(total, 0) - COALESCE(refund_amount, 0), 0)
             ELSE 0
           END) AS paid_revenue,
           SUM(CASE
             WHEN DATE(created_at) = CURDATE()
               AND payment_status = 'paid'
               AND order_status NOT IN ('cancelled', 'returned', 'failed')
               AND (LOWER(COALESCE(payment_method, 'online')) <> 'cod' OR order_status = 'delivered')
             THEN GREATEST(COALESCE(total, 0) - COALESCE(refund_amount, 0), 0)
             ELSE 0
           END) AS today_revenue,
           SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_orders
         FROM orders`
      ),
      pool.execute(
        `SELECT
           COUNT(*) AS products,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_products,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_products,
           SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived_products,
           SUM(CASE WHEN status = 'active' AND stock <= 5 THEN 1 ELSE 0 END) AS low_stock_products
         FROM products`
      ),
      pool.execute(
        `SELECT order_number, customer_name, total, payment_status, order_status, created_at
         FROM orders
         ORDER BY created_at DESC, id DESC
         LIMIT 5`
      ),
      pool.execute(
        `SELECT id, slug, name, stock, images
         FROM products
         WHERE status = 'active' AND stock <= 5
         ORDER BY stock ASC, updated_at DESC, name ASC
         LIMIT 5`
      )
    ]);

    const orderMetrics = orderRows[0][0] || {};
    const productMetrics = productRows[0][0] || {};

    return res.json({
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
        lowStockProducts: Number(productMetrics.low_stock_products) || 0
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
        images: parseJson(row.images)
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
