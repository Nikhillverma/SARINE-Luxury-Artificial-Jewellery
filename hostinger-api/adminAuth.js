import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";
import { shouldUseSecureSessionCookie } from "./sessionCookiePolicy.js";
import { recordAdminActivity } from "./adminActivityWriter.js";
import { ADMIN_ROLES, requireOwner } from "./adminPermissions.js";

const router = Router();

const COOKIE_NAME = "sarine_admin_session";
const SESSION_HOURS = 8;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: async (_req, res) => {
    await recordAdminActivity(
      { id: "unknown", name: "Unrecognized login attempt", email: "unavailable" },
      {
        action: "login_rate_limited",
        entityType: "admin session",
        summary: "Admin sign-in rate limit triggered",
        method: "POST",
        route: "/auth/login",
        statusCode: 429
      }
    );
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }
});

function readCookie(req, name) {
  const cookies = req.headers.cookie || "";

  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }

  return null;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_HOURS * 60 * 60 * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: shouldUseSecureSessionCookie(),
    sameSite: "lax",
    path: "/api"
  });
}

function safeAdmin(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || row.email.split("@")[0],
    role: row.role
  };
}

// Owner-only administrator management. New accounts receive a password chosen by the Owner.
router.get("/admins", requireOwner, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, name, role, status, last_login_at, created_at
       FROM admins ORDER BY created_at ASC`
    );
    return res.json({ admins: rows });
  } catch (error) { next(error); }
});

router.post("/admins", requireOwner, async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim();
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "");
    const emailParts = email.split("@");
    if (!email || email.length > 254 || emailParts.length !== 2 || !emailParts[0] || !emailParts[1].includes(".") || emailParts[1].startsWith(".") || emailParts[1].endsWith(".")) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!name || name.length > 120) return res.status(400).json({ error: "Enter an administrator name." });
    if (password.length < 12 || password.length > 256) {
      return res.status(400).json({ error: "Password must contain 12–256 characters." });
    }
    if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ error: "Select a supported non-owner role." });
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      `INSERT INTO admins
        (id, email, email_normalized, name, password_hash, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [id, email, email, name, passwordHash, role]
    );
    await recordAdminActivity(req.admin, {
      action: "create", entityType: "admin", entityId: id,
      summary: `Created administrator account for ${email}`,
      method: "POST", route: "/auth/admins", statusCode: 201
    });
    return res.status(201).json({ success: true, id });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "An administrator with this email already exists." });
    next(error);
  }
});

router.patch("/admins/:id", requireOwner, async (req, res, next) => {
  try {
    const id = String(req.params.id || "");
    const role = req.body?.role;
    const status = req.body?.status;
    if (!id) return res.status(400).json({ error: "Administrator ID is required." });
    if (role !== undefined && !ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ error: "Select a supported non-owner role." });
    }
    if (status !== undefined && !["active", "disabled"].includes(status)) {
      return res.status(400).json({ error: "Status must be active or disabled." });
    }
    const [rows] = await pool.execute("SELECT id, role, status FROM admins WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ error: "Administrator not found." });
    const target = rows[0];
    if (target.role === "admin" || target.role === "owner") {
      return res.status(403).json({ error: "The primary Owner account cannot be modified here." });
    }
    if (id === req.admin.id && status === "disabled") {
      return res.status(400).json({ error: "You cannot disable your own account." });
    }
    const nextRole = role ?? target.role;
    const nextStatus = status ?? target.status;
    await pool.execute(
      "UPDATE admins SET role = ?, status = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [nextRole, nextStatus, id]
    );
    if (nextStatus === "disabled") {
      await pool.execute("DELETE FROM admin_sessions WHERE admin_id = ?", [id]);
    }
    await recordAdminActivity(req.admin, {
      action: "update", entityType: "admin", entityId: id,
      summary: "Updated administrator role or account status",
      method: "PATCH", route: "/auth/admins/:id", statusCode: 200
    });
    return res.json({ success: true });
  } catch (error) { next(error); }
});

// POST /api/admin/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  res.set("Cache-Control", "no-store");

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || email.length > 254 || !password || password.length > 256) {
    await recordAdminActivity(
      { id: "unknown", name: "Unrecognized login attempt", email: "unavailable" },
      {
        action: "login_failed",
        entityType: "admin session",
        summary: "Admin sign-in rejected because required credentials were missing or invalid",
        method: "POST",
        route: "/auth/login",
        statusCode: 400
      }
    );
    return res.status(400).json({ error: "Enter a valid email and password." });
  }

  const [rows] = await pool.execute(
    `SELECT id, email, name, password_hash, role, status
     FROM admins
     WHERE email_normalized = ?
     LIMIT 1`,
    [email]
  );

  const admin = rows[0];

  if (!admin || admin.status !== "active") {
    await recordAdminActivity(
      admin ? safeAdmin(admin) : { id: "unknown", name: "Unrecognized login attempt", email: "unavailable" },
      {
        action: "login_failed",
        entityType: "admin session",
        entityId: admin?.id || null,
        summary: admin ? "Admin sign-in rejected for an inactive account" : "Admin sign-in rejected for an unrecognized account",
        method: "POST",
        route: "/auth/login",
        statusCode: 401
      }
    );
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const passwordMatches = await bcrypt.compare(password, admin.password_hash);

  if (!passwordMatches) {
    await recordAdminActivity(safeAdmin(admin), {
      action: "login_failed",
      entityType: "admin session",
      entityId: admin.id,
      summary: "Admin sign-in rejected because the password did not match",
      method: "POST",
      route: "/auth/login",
      statusCode: 401
    });
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await pool.execute(
    `INSERT INTO admin_sessions (id, admin_id, expires_at)
     VALUES (?, ?, ?)`,
    [sessionId, admin.id, expiresAt]
  );

  await pool.execute(
    "UPDATE admins SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
    [admin.id]
  );

  setSessionCookie(res, token);
  await recordAdminActivity(safeAdmin(admin), {
    action: "login", entityType: "admin session", entityId: admin.id,
    summary: "Administrator signed in", method: "POST", route: "/auth/login", statusCode: 200
  });

  return res.json({
    success: true,
    admin: safeAdmin(admin)
  });
});

// GET /api/admin/auth/session
router.get("/session", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const token = readCookie(req, COOKIE_NAME);

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(401).json({ authenticated: false });
  }

  const sessionId = hashToken(token);

  const [rows] = await pool.execute(
    `SELECT a.id, a.email, a.name, a.role
     FROM admin_sessions s
     INNER JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ?
       AND s.expires_at > CURRENT_TIMESTAMP(3)
       AND a.status = 'active'
     LIMIT 1`,
    [sessionId]
  );

  if (!rows.length) {
    clearSessionCookie(res);
    return res.status(401).json({ authenticated: false });
  }

  await pool.execute(
    "UPDATE admin_sessions SET last_used_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
    [sessionId]
  );

  return res.json({
    authenticated: true,
    admin: safeAdmin(rows[0])
  });
});

// POST /api/admin/auth/logout
router.post("/logout", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const token = readCookie(req, COOKIE_NAME);

  if (token && /^[a-f0-9]{64}$/i.test(token)) {
    const sessionId = hashToken(token);
    const [admins] = await pool.execute(
      `SELECT a.id, a.email, a.name, a.role
       FROM admin_sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.id = ? LIMIT 1`,
      [sessionId]
    );
    await pool.execute("DELETE FROM admin_sessions WHERE id = ?", [sessionId]);
    if (admins.length) {
      await recordAdminActivity(safeAdmin(admins[0]), {
        action: "logout", entityType: "admin session", entityId: admins[0].id,
        summary: "Administrator signed out", method: "POST", route: "/auth/logout", statusCode: 200
      });
    }
  }

  clearSessionCookie(res);

  return res.json({ success: true });
});

/**
 * Reusable Express middleware to protect administrative endpoints.
 * Authenticates via 'sarine_admin_session' cookie or Authorization Bearer header,
 * checks admin_sessions joined with admins, touches last_used_at, and sets req.admin.
 */
export async function requireAdminAuth(req, res, next) {
  let token = readCookie(req, COOKIE_NAME);
  if (!token) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(401).json({ error: "Unauthorized: Admin session required." });
  }

  const sessionId = hashToken(token);

  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.email, a.name, a.role
       FROM admin_sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.id = ?
         AND s.expires_at > CURRENT_TIMESTAMP(3)
         AND a.status = 'active'
       LIMIT 1`,
      [sessionId]
    );

    if (!rows.length) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Unauthorized: Admin session expired or invalid." });
    }

    await pool.execute(
      "UPDATE admin_sessions SET last_used_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [sessionId]
    );

    req.admin = safeAdmin(rows[0]);
    next();
  } catch (err) {
    console.error("requireAdminAuth error:", err);
    return res.status(500).json({ error: "Internal server error during auth verification." });
  }
}

export { readCookie, hashToken, COOKIE_NAME };
export default router;