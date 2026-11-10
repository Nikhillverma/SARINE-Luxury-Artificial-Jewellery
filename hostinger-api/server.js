import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool, testDatabase } from "./db.js";
import adminAuthRouter from "./adminAuth.js";
import adminOrdersRouter from "./adminOrders.js";
import ordersRouter from "./orders.js";

const app = express();
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

app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

function parseJson(value, fallback = []) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || "",
    shortDescription: row.short_description || "",
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null
      ? undefined
      : Number(row.compare_at_price),
    costPrice: row.cost_price === null
      ? undefined
      : Number(row.cost_price),
    images: parseJson(row.images),
    categoryId: row.category_id,
    collectionSlugs: parseJson(row.collection_slugs),
    jewelleryType: row.jewellery_type,
    stock: Number(row.stock),
    status: row.status,
    tags: parseJson(row.tags),
    baseMetal: row.base_metal || undefined,
    platingFinish: row.plating_finish || undefined,
    stoneType: row.stone_type || undefined,
    closureType: row.closure_type || undefined,
    careInstructions: parseJson(row.care_instructions),
    createdAt: row.created_at
  };
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
    const {
      categorySlug,
      categoryId,
      jewelleryType,
      collectionSlug,
      inStockOnly,
      minPrice,
      maxPrice,
      sortBy,
      page = "1",
      pageSize = "24",
      search
    } = req.query;

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

    if (inStockOnly === "true") {
      conditions.push("p.stock > 0");
    }

    if (
      minPrice !== undefined &&
      Number.isFinite(Number(minPrice))
    ) {
      conditions.push("p.price >= ?");
      values.push(Number(minPrice));
    }

    if (
      maxPrice !== undefined &&
      Number.isFinite(Number(maxPrice))
    ) {
      conditions.push("p.price <= ?");
      values.push(Number(maxPrice));
    }

    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      conditions.push(
        "(p.name LIKE ? OR p.description LIKE ? OR p.jewellery_type LIKE ?)"
      );
      values.push(term, term, term);
    }

    const orderOptions = {
      newest: "p.created_at DESC",
      "price-asc": "p.price ASC",
      "price-desc": "p.price DESC"
    };

    const orderBy = orderOptions[sortBy] || orderOptions.newest;
    const currentPage = Math.max(
      1,
      Number.parseInt(page, 10) || 1
    );
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSize, 10) || 24)
    );
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
      products: rows.map(mapProduct),
      total: Number(countRows[0].total),
      page: currentPage,
      pageSize: limit
    });
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
      product: mapProduct(rows[0])
    });
  } catch (error) {
    next(error);
  }
});

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

// Hostinger admin authentication
app.use("/api/admin/auth", adminAuthRouter);

// Hostinger admin orders
app.use("/api/admin/orders", adminOrdersRouter);

// Hostinger orders router
app.use("/api/orders", ordersRouter);

// Backward-compatible direct aliases for existing Netlify callers
app.post("/api/create-order", (req, res, next) => {
  req.url = "/create";
  ordersRouter(req, res, next);
});
app.post("/api/verify-payment", (req, res, next) => {
  req.url = "/verify";
  ordersRouter(req, res, next);
});
app.get("/api/get-order", (req, res, next) => {
  const orderNumber = req.query.orderNumber;
  if (!orderNumber) {
    return res.status(400).json({ error: "Missing orderNumber parameter." });
  }
  req.url = `/${encodeURIComponent(String(orderNumber).trim())}`;
  ordersRouter(req, res, next);
});
app.post("/api/track-order", (req, res, next) => {
  req.url = "/track";
  ordersRouter(req, res, next);
});
app.get("/api/admin-list-orders", (req, res, next) => {
  req.url = "/";
  adminOrdersRouter(req, res, next);
});
app.post("/api/admin-update-order", (req, res, next) => {
  req.url = "/update";
  adminOrdersRouter(req, res, next);
});
app.post("/api/razorpay-webhook", (req, res, next) => {
  req.url = "/webhook";
  ordersRouter(req, res, next);
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SARINE Hostinger API listening on port ${PORT}`);
});

