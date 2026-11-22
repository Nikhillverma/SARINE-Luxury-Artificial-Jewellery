import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool, testDatabase } from "./db.js";
import { markExistingOrdersAsPrelaunchTests, markNamedTestProductOrdersAsTests } from "./prelaunchOrderMigration.js";
import adminAuthRouter from "./adminAuth.js";
import { publicContactInquiriesRouter, adminContactInquiriesRouter } from "./contactInquiries.js";
import { ensureContactInquiriesSchema } from "./contactInquirySchema.js";
import adminCustomerAuthRouter from "./adminCustomerAuth.js";
import customerAuthRouter from "./customerAuth.js";
import customerOtpAuthRouter from "./customerOtpAuth.js";
import customerGoogleAuthRouter from "./customerGoogleAuth.js";
import adminDatabaseAuditRouter from "./adminDatabaseAudit.js";
import adminOrdersRouter from "./adminOrders.js";
import adminReturnsRouter from "./adminReturns.js";
import adminRefundsRouter from "./adminRefunds.js";
import adminDashboardRouter from "./adminDashboard.js";
import adminAnalyticsRouter from "./adminAnalytics.js";
import adminProductsRouter from "./adminProducts.js";
import adminInventoryRouter from "./adminInventory.js";
import adminInventorySettingsRouter from "./inventorySettings.js";
import adminCategoriesRouter from "./adminCategories.js";
import adminCustomersRouter from "./adminCustomers.js";
import adminMarketingRouter from "./adminMarketing.js";
import publicCouponsRouter from "./publicCoupons.js";
import adminStorefrontRouter, { publicStorefrontRouter } from "./adminStorefront.js";
import adminHomepageLayoutRouter, { publicHomepageLayoutRouter } from "./homepageLayout.js";
import adminCmsPagesRouter, { publicCmsPagesRouter } from "./cmsPages.js";
import adminCuratedFavouritesRouter, { publicCuratedFavouritesRouter } from "./curatedFavourites.js";
import adminExploreNowRouter, { publicExploreNowRouter } from "./exploreNow.js";
import ordersRouter from "./orders.js";
import razorpayWebhooksRouter from "./razorpayWebhooks.js";
import { publicMediaRouter, adminMediaRouter } from "./media.js";
import { getProductVariants } from "./productVariantSchema.js";
import { isAllowedBrowserOrigin } from "./adminOriginPolicy.js";
import { mapPublicProduct } from "./publicProductMapper.js";
import { parseCatalogueQuery } from "./catalogueQueryPolicy.js";
import { ensureProductVideoColumn } from "./productVideoSchema.js";
import { ensureOrderStatusSchema } from "./orderStatusSchema.js";

const app = express();

// Hostinger runs this API behind one trusted reverse proxy.
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);

const allowedOrigins = new Set([
  "https://lavender-emu-732118.hostingersite.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.add(process.env.FRONTEND_ORIGIN);
}

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
}));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

// Verify webhook signatures against raw bytes before JSON parsing.
app.use("/api/webhooks", razorpayWebhooksRouter);

app.use(express.json({
  limit: "4mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

async function mapProductsWithVariants(rows) {
  const grouped = await getProductVariants(rows.map(row => row.id), { activeOnly: true });
  return rows.map(row => ({
    ...mapPublicProduct(row),
    variants: grouped.get(row.id) || []
  }));
}

function mapCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    image: row.image || "",
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order)
  };
}

// Friendly root response for the public backend URL. API routes remain unchanged.
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "SARINE Hostinger API",
    message: "SARINE API is running.",
    health: "/health",
    databaseHealth: "/health/db"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "SARINE Hostinger API"
  });
});

app.get("/health/db", async (_req, res) => {
  try {
    await testDatabase();
    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({
      status: "error",
      database: "unavailable"
    });
  }
});

// Public product catalogue
app.get("/api/products", async (req, res, next) => {
  try {
    const parsedQuery = parseCatalogueQuery(req.query);
    if (parsedQuery.error) return res.status(400).json({ error: parsedQuery.error });
    const { categorySlug, categoryId, jewelleryType, collectionSlug, inStockOnly, minPrice, maxPrice, sortBy, page: currentPage, pageSize: limit, search } = parsedQuery.filters;
    const conditions = ["p.status = 'active'"];
    const values = [];

    if (categoryId) {
      conditions.push("p.category_id = ?");
      values.push(String(categoryId));
    }

    if (categorySlug) {
      conditions.push("c.slug = ?");
      values.push(String(categorySlug));
    }

    if (jewelleryType) {
      conditions.push("p.jewellery_type = ?");
      values.push(String(jewelleryType));
    }

    if (collectionSlug) {
      conditions.push(
        "JSON_CONTAINS(p.collection_slugs, JSON_QUOTE(?))"
      );
      values.push(String(collectionSlug));
    }

    if (inStockOnly) {
      conditions.push("p.stock > 0");
    }

    if (minPrice !== undefined) {
      conditions.push("p.price >= ?");
      values.push(minPrice);
    }

    if (maxPrice !== undefined) {
      conditions.push("p.price <= ?");
      values.push(maxPrice);
    }

    if (search) {
      // Treat SQL LIKE metacharacters as literal customer search text.
      const term = "%" + search.replace(/[!%_]/g, "!$&") + "%";
      conditions.push("(p.name LIKE ? ESCAPE '!' OR p.description LIKE ? ESCAPE '!' OR p.jewellery_type LIKE ? ESCAPE '!')");
      values.push(term, term, term);
    }
    const orderOptions = {
      newest: "p.created_at DESC",
      "price-asc": "p.price ASC",
      "price-desc": "p.price DESC"
    };

    const orderBy = orderOptions[sortBy];
    const offset = (currentPage - 1) * limit;
    const where = conditions.join(" AND ");

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where}`,
      values
    );

    const [rows] = await pool.execute(
      `SELECT p.*
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );

    res.json({
      products: await mapProductsWithVariants(rows),
      total: Number(countRows[0].total),
      page: currentPage,
      pageSize: limit
    });
  } catch (error) {
    next(error);
  }
});

// Public best sellers: rank by units in completed, paid orders only.
app.get("/api/bestsellers", async (req, res, next) => {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(24, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 8));
    const [rows] = await pool.execute(
      `SELECT p.*
       FROM products p
       INNER JOIN (
         SELECT oi.product_id,
           SUM(oi.quantity) AS units_sold,
           SUM(oi.quantity * oi.unit_price) AS item_sales
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE o.is_test = 0
           AND o.payment_status = 'paid'
           AND o.order_status NOT IN ('cancelled', 'returned', 'failed', 'needs_refund')
           AND (LOWER(COALESCE(o.payment_method, 'online')) <> 'cod' OR o.order_status = 'delivered')
         GROUP BY oi.product_id
       ) sales ON sales.product_id = p.id
       WHERE p.status = 'active' AND p.stock > 0
       ORDER BY sales.units_sold DESC, sales.item_sales DESC, p.created_at DESC
       LIMIT ?`,
      [limit]
    );
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json({ products: await mapProductsWithVariants(rows) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:slug", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM products
       WHERE slug = ? AND status = 'active'
       LIMIT 1`,
      [req.params.slug]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    res.json({
      product: (await mapProductsWithVariants(rows))[0]
    });
  } catch (error) {
    next(error);
  }
});

function requireTrustedBrowserOrigin(req, res, next) {
  const origin = req.get("Origin");
  if (!isAllowedBrowserOrigin(origin, allowedOrigins)) {
    return res.status(403).json({ error: "Untrusted origin for this request." });
  }
  return next();
}

// CORS and explicit origin validation provide defence in depth for browser
// requests that rely on cookies. Reject untrusted origins before any admin,
// customer-account, or checkout/payment mutation route is reached.
app.use("/api/admin", requireTrustedBrowserOrigin);
app.use("/api/customer/auth", requireTrustedBrowserOrigin);
app.use("/api/orders", requireTrustedBrowserOrigin);
app.use("/api/contact", requireTrustedBrowserOrigin);
app.use("/api/contact", publicContactInquiriesRouter);
app.use("/api/admin/contact-inquiries", adminContactInquiriesRouter);

app.use("/api/marketing/coupons", publicCouponsRouter);
app.use("/api/admin/marketing", adminMarketingRouter);

// Public storefront content managed from the admin panel.
app.use("/api/pages", publicCmsPagesRouter);
app.use("/api/admin/pages", adminCmsPagesRouter);
app.use("/api/storefront", publicStorefrontRouter);
app.use("/api/homepage-layout", publicHomepageLayoutRouter);
app.use("/api/curated-favourites", publicCuratedFavouritesRouter);
app.use("/api/explore-now", publicExploreNowRouter);
app.use("/api/admin/curated-favourites", adminCuratedFavouritesRouter);
app.use("/api/admin/explore-now", adminExploreNowRouter);
app.use("/api/admin/homepage-layout", adminHomepageLayoutRouter);
app.use("/api/admin/storefront", adminStorefrontRouter);

// Public category catalogue
app.get("/api/categories", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`
    );

    res.json({
      categories: rows.map(mapCategory)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/categories/:slug", async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM categories
       WHERE slug = ? AND is_active = 1
       LIMIT 1`,
      [req.params.slug]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "Category not found"
      });
    }

    res.json({
      category: mapCategory(rows[0])
    });
  } catch (error) {
    next(error);
  }
});

// Public immutable media URLs and authenticated media uploads.
app.use("/api/media", publicMediaRouter);
app.use("/api/admin/media", adminMediaRouter);

// Hostinger customer and admin authentication
app.use("/api/customer/auth", customerGoogleAuthRouter);
app.use("/api/customer/auth", customerOtpAuthRouter);
app.use("/api/customer/auth", customerAuthRouter);
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin/customer-auth", adminCustomerAuthRouter);
app.use("/api/admin/database-audit", adminDatabaseAuditRouter);

// Hostinger admin dashboard, category and product management
app.use("/api/admin/dashboard", adminDashboardRouter);
app.use("/api/admin/analytics", adminAnalyticsRouter);
app.use("/api/admin/categories", adminCategoriesRouter);
app.use("/api/admin/customers", adminCustomersRouter);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/inventory", adminInventoryRouter);
app.use("/api/admin/inventory-settings", adminInventorySettingsRouter);

// Hostinger admin orders and returns/refund request queues
app.use("/api/admin/orders", adminOrdersRouter);
app.use("/api/admin/returns", adminReturnsRouter);
app.use("/api/admin/refunds", adminRefundsRouter);

// Signed Razorpay webhook intake (raw request bytes are retained by express.json verify).
// Hostinger orders router
app.use("/api/orders", ordersRouter);

// Legacy direct API aliases for existing storefront callers
app.post("/api/create-order", requireTrustedBrowserOrigin, (req, res, next) => {
  req.url = "/create";
  ordersRouter(req, res, next);
});
app.post("/api/verify-payment", requireTrustedBrowserOrigin, (req, res, next) => {
  req.url = "/verify";
  ordersRouter(req, res, next);
});
app.get("/api/get-order", requireTrustedBrowserOrigin, (req, res, next) => {
  const orderNumber = req.query.orderNumber;
  if (!orderNumber) {
    return res.status(400).json({ error: "Missing orderNumber parameter." });
  }
  req.url = `/${encodeURIComponent(String(orderNumber).trim())}`;
  ordersRouter(req, res, next);
});
app.post("/api/track-order", requireTrustedBrowserOrigin, (req, res, next) => {
  req.url = "/track";
  ordersRouter(req, res, next);
});
app.get("/api/admin-list-orders", requireTrustedBrowserOrigin, (req, res, next) => {
  req.url = "/";
  adminOrdersRouter(req, res, next);
});
app.post("/api/admin-update-order", requireTrustedBrowserOrigin, (req, res, next) => {
  req.url = "/update";
  adminOrdersRouter(req, res, next);
});

// Central error handler
app.use((error, _req, res, _next) => {
  console.error("API error:", error.message);

  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      error: "Origin not allowed"
    });
  }

  res.status(500).json({
    error: "An unexpected server error occurred"
  });
});

async function startServer() {
  // Finish the one-time pre-launch order classification before accepting requests.
  await markExistingOrdersAsPrelaunchTests();
  const migrationConnection = await pool.getConnection();
  try {
    await markNamedTestProductOrdersAsTests(migrationConnection);
  } finally {
    migrationConnection.release();
  }
  await ensureProductVideoColumn();
  await ensureOrderStatusSchema();
  await ensureContactInquiriesSchema();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SARINE Hostinger API listening on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error("SARINE startup migration failed:", error);
  process.exitCode = 1;
});

