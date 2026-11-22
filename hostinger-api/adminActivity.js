import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

const ENTITY_LABELS = {
  products: "product",
  categories: "category",
  orders: "order",
  inventory: "inventory",
  "inventory-settings": "inventory settings",
  customers: "customer",
  returns: "return",
  refunds: "refund",
  marketing: "coupon",
  storefront: "storefront",
  pages: "content page",
  "homepage-layout": "homepage layout",
  "curated-favourites": "curated favourites",
  "explore-now": "explore section",
  "carousel-features": "carousel feature",
  "contact-inquiries": "customer enquiry",
  reviews: "review",
  settings: "store settings",
  media: "media"
};

const SPECIAL_SEGMENTS = new Set([
  "update", "bulk", "status", "archive", "adjustments", "variants",
  "movements", "preview", "publish", "unpublish", "reorder", "upload",
  "coupons", "login", "logout", "session"
]);

export async function ensureAdminActivitySchema() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin_id VARCHAR(64) NOT NULL,
      admin_name VARCHAR(160) NOT NULL,
      admin_email VARCHAR(254) NOT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(190) NULL,
      summary VARCHAR(500) NOT NULL,
      http_method VARCHAR(10) NOT NULL,
      route VARCHAR(255) NOT NULL,
      status_code SMALLINT UNSIGNED NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_admin_activity_created (created_at),
      KEY idx_admin_activity_admin_created (admin_id, created_at),
      KEY idx_admin_activity_entity (entity_type, entity_id),
      KEY idx_admin_activity_action_created (action, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function cleanText(value, maxLength = 180) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\\u0000-\\u001f\\u007f]/g, " ").trim().slice(0, maxLength);
}

function describeActivity(req) {
  const method = String(req.method || "POST").toUpperCase();
  const route = String(req.originalUrl || req.path || "").split("?")[0]
    .replace(/^\\/api\\/admin/, "").slice(0, 255);
  const segments = route.split("/").filter(Boolean);
  const root = segments[0] || "admin";
  const entityType = ENTITY_LABELS[root] || "admin setting";
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const verb = method === "POST" ? "created" : method === "DELETE" ? "deleted" : "updated";
  const suppliedAction = root === "orders" ? cleanText(body.action, 70) : "";
  const action = (suppliedAction || `${method.toLowerCase()} ${root}`).slice(0, 100);

  const routeId = segments.slice(1).find(segment => !SPECIAL_SEGMENTS.has(segment)) || "";
  const entityId = cleanText(
    root === "orders" ? body.orderNumber || routeId :
    routeId || body.id || body.productId || body.categoryId || body.couponId,
    190
  );

  // Only a small, explicit allowlist is retained. Request bodies, customer details,
  // passwords, session tokens, payment payloads and uploaded content are never stored.
  const label = cleanText(body.orderNumber || body.name || body.code || body.title || body.slug, 160);
  const actionText = suppliedAction
    ? `${entityType} ${suppliedAction.replace(/_/g, " ")}`
    : `${entityType} ${verb}`;
  const summary = `${actionText}${label ? ` · ${label}` : entityId ? ` · ${entityId}` : ""}`.slice(0, 500);

  return { action, entityType, entityId: entityId || null, summary, method, route };
}

/**
 * Attach before admin routers. The route's own requireAdminAuth middleware sets
 * req.admin; the finish hook writes only successful mutation events.
 */
export function captureAdminActivity(req, res, next) {
  const method = String(req.method || "").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();

  res.once("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400 || !req.admin?.id) return;
    const event = describeActivity(req);
    const admin = req.admin;
    pool.execute(
      `INSERT INTO admin_activity_logs
       (admin_id, admin_name, admin_email, action, entity_type, entity_id,
        summary, http_method, route, status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanText(admin.id, 64),
        cleanText(admin.name || admin.email, 160),
        cleanText(admin.email, 254),
        event.action,
        event.entityType,
        event.entityId,
        event.summary,
        event.method,
        event.route,
        res.statusCode
      ]
    ).catch(error => {
      console.error("Admin activity audit write failed:", error.message);
    });
  });

  next();
}

function dateBoundary(value, nextDay = false) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00+05:30");
  if (!Number.isFinite(date.getTime())) return null;
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = cleanText(req.query.search, 100);
    const actionFilter = cleanText(req.query.action, 100);
    const entityFilter = cleanText(req.query.entityType, 80);
    const conditions = [];
    const values = [];

    if (search) {
      const term = "%" + search.replace(/[!%_]/g, "!$&") + "%";
      conditions.push("(admin_name LIKE ? ESCAPE '!' OR admin_email LIKE ? ESCAPE '!' OR action LIKE ? ESCAPE '!' OR entity_type LIKE ? ESCAPE '!' OR entity_id LIKE ? ESCAPE '!' OR summary LIKE ? ESCAPE '!')");
      values.push(term, term, term, term, term, term);
    }
    if (actionFilter) {
      conditions.push("action = ?");
      values.push(actionFilter);
    }
    if (entityFilter) {
      conditions.push("entity_type = ?");
      values.push(entityFilter);
    }
    if (req.query.from) {
      const from = dateBoundary(String(req.query.from));
      if (!from) return res.status(400).json({ error: "Invalid start date." });
      conditions.push("created_at >= ?");
      values.push(from);
    }
    if (req.query.to) {
      const to = dateBoundary(String(req.query.to), true);
      if (!to) return res.status(400).json({ error: "Invalid end date." });
      conditions.push("created_at < ?");
      values.push(to);
    }

    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const [summaryRows] = await pool.execute(
      `SELECT COUNT(*) AS total,
              SUM(created_at >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR) AS last24Hours,
              COUNT(DISTINCT admin_id) AS administrators
       FROM admin_activity_logs${where}`,
      values
    );
    const [rows] = await pool.execute(
      `SELECT id, admin_id AS adminId, admin_name AS adminName,
              admin_email AS adminEmail, action, entity_type AS entityType,
              entity_id AS entityId, summary, http_method AS method,
              route, status_code AS statusCode, created_at AS createdAt
       FROM admin_activity_logs${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, (page - 1) * limit]
    );
    const total = Number(summaryRows[0]?.total || 0);
    res.set("Cache-Control", "no-store");
    return res.json({
      activities: rows,
      summary: {
        total,
        last24Hours: Number(summaryRows[0]?.last24Hours || 0),
        administrators: Number(summaryRows[0]?.administrators || 0)
      },
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
