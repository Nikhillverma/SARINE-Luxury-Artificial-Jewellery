import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";
import { normalizeCustomerEmail } from "./customerValidation.js";

const router = Router();
router.use(requireAdminAuth);
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10000;


function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const INITIAL_ORDER_DATE = "(SELECT MIN(h.created_at) " +
  "FROM order_status_history h " +
  "WHERE h.order_id = o.id " +
  "AND h.old_status IS NULL " +
  "AND h.new_status IN ('placed', 'awaiting_payment'))";

router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
    const limit = positiveInteger(req.query.limit, 50, MAX_PAGE_SIZE);
    const offset = Math.min(Math.max(Number.parseInt(String(req.query.offset || "0"), 10) || 0, 0), MAX_OFFSET);
    const conditions = ["o.customer_email IS NOT NULL", "TRIM(o.customer_email) <> ''"];
    const values = [];

    if (search) {
      conditions.push("(LOWER(TRIM(o.customer_email)) LIKE ? OR LOWER(COALESCE(o.customer_name, '')) LIKE ? OR COALESCE(o.customer_phone, '') LIKE ?)");
      values.push("%" + search.toLowerCase() + "%", "%" + search.toLowerCase() + "%", "%" + search + "%");
    }
    const where = conditions.join(" AND ");

    const [countRows] = await pool.execute(
      "SELECT COUNT(DISTINCT LOWER(TRIM(o.customer_email))) AS total FROM orders o WHERE " + where,
      values
    );

    const sql = "SELECT LOWER(TRIM(o.customer_email)) AS email, " +
      "MAX(NULLIF(TRIM(o.customer_name), '')) AS name, " +
      "MAX(NULLIF(TRIM(o.customer_phone), '')) AS phone, " +
      "MAX(NULLIF(CASE WHEN JSON_VALID(o.shipping_address) THEN JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.city')) ELSE NULL END, '')) AS city, " +
      "MAX(NULLIF(CASE WHEN JSON_VALID(o.shipping_address) THEN JSON_UNQUOTE(JSON_EXTRACT(o.shipping_address, '$.state')) ELSE NULL END, '')) AS state, " +
      "COUNT(*) AS total_orders, " +
      "SUM(CASE WHEN o.payment_status = 'paid' OR (o.payment_method = 'cod' AND o.order_status = 'delivered') " +
      "THEN COALESCE(o.total, 0) ELSE 0 END) AS lifetime_spend, " +
      "MAX(COALESCE(o.created_at, " + INITIAL_ORDER_DATE + ")) AS last_order_at " +
      "FROM orders o WHERE " + where +
      " GROUP BY LOWER(TRIM(o.customer_email)) ORDER BY last_order_at DESC, email ASC LIMIT ? OFFSET ?";

    const [rows] = await pool.execute(sql, [...values, limit, offset]);
    return res.json({
      customers: rows.map((row) => ({
        email: row.email,
        name: row.name || row.email.split("@")[0],
        phone: row.phone || "",
        city: row.city || "",
        state: row.state || "",
        totalOrders: Number(row.total_orders) || 0,
        lifetimeSpend: Number(row.lifetime_spend) || 0,
        lastOrderAt: toIsoString(row.last_order_at)
      })),
      total: Number(countRows[0]?.total) || 0,
      limit,
      offset
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:email/orders", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const email = normalizeCustomerEmail(req.params.email);
    if (!email) return res.status(400).json({ error: "Enter a valid customer email address." });

    const sql = "SELECT o.id, o.order_number, o.created_at, o.total, o.payment_method, o.payment_status, o.order_status " +
      "FROM orders o WHERE LOWER(TRIM(o.customer_email)) = ? " +
      "ORDER BY COALESCE(o.created_at, " + INITIAL_ORDER_DATE + ") DESC, o.id DESC LIMIT 100";
    const [orders] = await pool.execute(sql, [email]);
    const ids = orders.map((order) => order.id);
    const itemsByOrder = {};

    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [items] = await pool.query(
        "SELECT order_id, product_name, quantity, unit_price FROM order_items " +
        "WHERE order_id IN (" + placeholders + ") ORDER BY source_line ASC, id ASC",
        ids
      );
      for (const item of items) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push({
          name: item.product_name || "Product",
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unit_price) || 0
        });
      }
    }

    return res.json({
      email,
      orders: orders.map((order) => ({
        orderNumber: order.order_number,
        createdAt: toIsoString(order.created_at),
        total: Number(order.total) || 0,
        paymentMethod: order.payment_method || "",
        paymentStatus: order.payment_status || "",
        orderStatus: order.order_status || "",
        items: itemsByOrder[order.id] || []
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
