import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");

    const [
      [orderCounts],
      [revenueRows],
      [productCounts],
      [customerCounts],
      [recentRows],
      [lowStockRows]
    ] = await Promise.all([
      pool.execute(`SELECT
        COUNT(*) AS total,
        SUM(order_status IN ('pending','awaiting_payment')) AS pending,
        SUM(order_status = 'processing') AS processing,
        SUM(order_status = 'shipped') AS shipped,
        SUM(order_status = 'delivered') AS delivered,
        SUM(order_status = 'cancelled') AS cancelled
        FROM orders`),
      pool.execute(`SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS paid_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' AND created_at >= CURRENT_DATE() THEN total ELSE 0 END), 0) AS today_revenue,
        COUNT(CASE WHEN created_at >= CURRENT_DATE() THEN 1 END) AS today_orders
        FROM orders`),
      pool.execute(`SELECT
        COUNT(*) AS total,
        SUM(status = 'active') AS active,
        SUM(status = 'draft') AS draft,
        SUM(status = 'archived') AS archived,
        SUM(status = 'active' AND stock <= 5) AS low_stock
        FROM products`),
      pool.execute(`SELECT COUNT(*) AS total,
        SUM(status = 'active') AS active
        FROM customers`),
      pool.execute(`SELECT order_number, customer_name, total, payment_status, order_status, created_at
        FROM orders ORDER BY created_at DESC, id DESC LIMIT 8`),
      pool.execute(`SELECT id, slug, name, stock, images
        FROM products WHERE status = 'active' AND stock <= 5
        ORDER BY stock ASC, name ASC LIMIT 8`)
    ]);

    const parseImages = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value !== "string" || !value) return [];
      try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
      catch { return []; }
    };

    res.json({
      metrics: {
        orders: Number(orderCounts[0]?.total || 0),
        pendingOrders: Number(orderCounts[0]?.pending || 0),
        processingOrders: Number(orderCounts[0]?.processing || 0),
        shippedOrders: Number(orderCounts[0]?.shipped || 0),
        deliveredOrders: Number(orderCounts[0]?.delivered || 0),
        cancelledOrders: Number(orderCounts[0]?.cancelled || 0),
        paidRevenue: Number(revenueRows[0]?.paid_revenue || 0),
        todayRevenue: Number(revenueRows[0]?.today_revenue || 0),
        todayOrders: Number(revenueRows[0]?.today_orders || 0),
        products: Number(productCounts[0]?.total || 0),
        activeProducts: Number(productCounts[0]?.active || 0),
        draftProducts: Number(productCounts[0]?.draft || 0),
        archivedProducts: Number(productCounts[0]?.archived || 0),
        lowStockProducts: Number(productCounts[0]?.low_stock || 0),
        customers: Number(customerCounts[0]?.total || 0),
        activeCustomers: Number(customerCounts[0]?.active || 0)
      },
      recentOrders: recentRows.map((row) => ({
        orderNumber: row.order_number,
        customerName: row.customer_name,
        total: Number(row.total),
        paymentStatus: row.payment_status,
        orderStatus: row.order_status,
        createdAt: row.created_at
      })),
      lowStockProducts: lowStockRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        stock: Number(row.stock),
        images: parseImages(row.images)
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
