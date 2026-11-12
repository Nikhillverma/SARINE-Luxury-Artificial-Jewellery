import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

const IST_OFFSET_MINUTES = 330;
const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value + "T00:00:00Z"))
    && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}

function istToday() {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

function shiftDate(date, days) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function istMidnightAsUtc(date) {
  return new Date(Date.parse(date + "T00:00:00Z") - IST_OFFSET_MINUTES * 60_000);
}

function rangeFromQuery(query) {
  const to = query.to ? String(query.to) : istToday();
  const from = query.from ? String(query.from) : shiftDate(to, -29);
  if (!validDate(from) || !validDate(to) || from > to) {
    const error = new Error("Choose valid dates. The start date must be on or before the end date.");
    error.status = 400;
    throw error;
  }
  if ((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY_MS > 365) {
    const error = new Error("Date range cannot exceed 366 calendar days.");
    error.status = 400;
    throw error;
  }
  return {
    from, to,
    startUtc: istMidnightAsUtc(from),
    endUtc: istMidnightAsUtc(shiftDate(to, 1))
  };
}

const PAID_ORDER = `payment_status = 'paid'
  AND order_status NOT IN ('cancelled', 'returned', 'failed')
  AND (LOWER(COALESCE(payment_method, 'online')) <> 'cod' OR order_status = 'delivered')`;

async function buildReport(range) {
  const params = [range.startUtc, range.endUtc];
  const [summaryRows, dailyRows, statusRows, paymentRows, productRows, categoryRows, inventoryRows] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) AS total_orders,
        SUM(CASE WHEN ${PAID_ORDER} THEN 1 ELSE 0 END) AS paid_orders,
        SUM(CASE WHEN ${PAID_ORDER} THEN GREATEST(COALESCE(total,0)-COALESCE(refund_amount,0),0) ELSE 0 END) AS net_revenue,
        SUM(CASE WHEN ${PAID_ORDER} THEN COALESCE(refund_amount,0) ELSE 0 END) AS refunds,
        SUM(CASE WHEN payment_status = 'pending' OR payment_status = 'failed' THEN 1 ELSE 0 END) AS unpaid_orders,
        SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
       FROM orders WHERE created_at >= ? AND created_at < ?`,
      params
    ),
    pool.execute(
      `SELECT DATE(DATE_ADD(created_at, INTERVAL 330 MINUTE)) AS report_day,
        COUNT(*) AS orders,
        SUM(CASE WHEN ${PAID_ORDER} THEN GREATEST(COALESCE(total,0)-COALESCE(refund_amount,0),0) ELSE 0 END) AS revenue
       FROM orders WHERE created_at >= ? AND created_at < ?
       GROUP BY DATE(DATE_ADD(created_at, INTERVAL 330 MINUTE))
       ORDER BY report_day ASC`,
      params
    ),
    pool.execute(
      `SELECT order_status AS label, COUNT(*) AS count
       FROM orders WHERE created_at >= ? AND created_at < ?
       GROUP BY order_status ORDER BY count DESC`,
      params
    ),
    pool.execute(
      `SELECT COALESCE(payment_method,'unknown') AS label, COUNT(*) AS count,
        SUM(CASE WHEN ${PAID_ORDER} THEN GREATEST(COALESCE(total,0)-COALESCE(refund_amount,0),0) ELSE 0 END) AS revenue
       FROM orders WHERE created_at >= ? AND created_at < ?
       GROUP BY payment_method ORDER BY count DESC`,
      params
    ),
    pool.execute(
      `SELECT oi.product_id AS productId, oi.product_name AS productName,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.quantity * oi.unit_price) AS item_sales
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= ? AND o.created_at < ?
         AND ${PAID_ORDER.replaceAll("payment_status", "o.payment_status").replaceAll("order_status", "o.order_status").replaceAll("payment_method", "o.payment_method").replaceAll("total", "o.total").replaceAll("refund_amount", "o.refund_amount")}
       GROUP BY oi.product_id, oi.product_name
       ORDER BY units_sold DESC, item_sales DESC
       LIMIT 50`,
      params
    ),
    pool.execute(
      `SELECT COALESCE(c.name, 'Uncategorised') AS category,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.quantity * oi.unit_price) AS item_sales
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE o.created_at >= ? AND o.created_at < ?
         AND ${PAID_ORDER.replaceAll("payment_status", "o.payment_status").replaceAll("order_status", "o.order_status").replaceAll("payment_method", "o.payment_method").replaceAll("total", "o.total").replaceAll("refund_amount", "o.refund_amount")}
       GROUP BY c.name ORDER BY item_sales DESC`,
      params
    ),
    pool.execute(
      `SELECT p.id, p.name, p.status, p.stock, p.price, p.cost_price,
        COALESCE(c.name, 'Uncategorised') AS category
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.stock ASC, p.name ASC LIMIT 500`
    )
  ]);

  const summary = summaryRows[0][0] || {};
  const paidOrders = Number(summary.paid_orders) || 0;
  return {
    range: { from: range.from, to: range.to, timezone: "Asia/Kolkata" },
    summary: {
      totalOrders: Number(summary.total_orders) || 0,
      paidOrders,
      netRevenue: Number(summary.net_revenue) || 0,
      refunds: Number(summary.refunds) || 0,
      averagePaidOrderValue: paidOrders ? (Number(summary.net_revenue) || 0) / paidOrders : 0,
      unpaidOrders: Number(summary.unpaid_orders) || 0,
      cancelledOrders: Number(summary.cancelled_orders) || 0
    },
    daily: dailyRows[0].map(row => ({ date: row.report_day, orders: Number(row.orders) || 0, revenue: Number(row.revenue) || 0 })),
    orderStatuses: statusRows[0].map(row => ({ label: row.label || "unknown", count: Number(row.count) || 0 })),
    payments: paymentRows[0].map(row => ({ label: row.label, count: Number(row.count) || 0, revenue: Number(row.revenue) || 0 })),
    topProducts: productRows[0].map(row => ({ productId: row.productId, productName: row.productName, unitsSold: Number(row.units_sold) || 0, itemSales: Number(row.item_sales) || 0 })),
    categories: categoryRows[0].map(row => ({ category: row.category, unitsSold: Number(row.units_sold) || 0, itemSales: Number(row.item_sales) || 0 })),
    inventory: inventoryRows[0].map(row => ({
      productId: row.id, productName: row.name, category: row.category,
      status: row.status, stock: Number(row.stock) || 0,
      price: Number(row.price) || 0,
      costPrice: row.cost_price == null ? null : Number(row.cost_price)
    }))
  };
}

function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function cell(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function worksheet(name, headers, rows) {
  const allRows = [headers, ...rows];
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${allRows.map(row =>
    `<Row>${row.map(cell).join("")}</Row>`
  ).join("")}</Table></Worksheet>`;
}

function workbookXml(report) {
  const sheets = [
    worksheet("Summary", ["Metric", "Value"], [
      ["From", report.range.from], ["To", report.range.to], ["Timezone", report.range.timezone],
      ["Total orders", report.summary.totalOrders], ["Paid orders", report.summary.paidOrders],
      ["Net paid revenue INR", report.summary.netRevenue], ["Refunds INR", report.summary.refunds],
      ["Average paid order value INR", report.summary.averagePaidOrderValue],
      ["Unpaid orders", report.summary.unpaidOrders], ["Cancelled orders", report.summary.cancelledOrders]
    ]),
    worksheet("Daily Sales", ["Date (IST)", "Orders", "Net revenue INR"], report.daily.map(x => [x.date, x.orders, x.revenue])),
    worksheet("Order Status", ["Status", "Orders"], report.orderStatuses.map(x => [x.label, x.count])),
    worksheet("Payments", ["Payment method", "Orders", "Net revenue INR"], report.payments.map(x => [x.label, x.count, x.revenue])),
    worksheet("Top Products", ["Product ID", "Product", "Units sold", "Item sales INR"], report.topProducts.map(x => [x.productId, x.productName, x.unitsSold, x.itemSales])),
    worksheet("Categories", ["Category", "Units sold", "Item sales INR"], report.categories.map(x => [x.category, x.unitsSold, x.itemSales])),
    worksheet("Inventory", ["Product ID", "Product", "Category", "Status", "Stock", "Selling price INR", "Cost price INR"], report.inventory.map(x => [x.productId, x.productName, x.category, x.status, x.stock, x.price, x.costPrice ?? "Not set"]))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
  <?mso-application progid="Excel.Sheet"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>SARINE Analytics Report</Title><Subject>Store analytics</Subject></DocumentProperties>
  ${sheets.join("")}</Workbook>`;
}

router.get("/", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const range = rangeFromQuery(req.query);
    res.json(await buildReport(range));
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    next(error);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    const range = rangeFromQuery(req.query);
    const report = await buildReport(range);
    const filename = `sarine-analytics-${range.from}-to-${range.to}.xls`;
    res.set({
      "Cache-Control": "no-store",
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    });
    res.send("\uFEFF" + workbookXml(report));
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    next(error);
  }
});

export default router;
