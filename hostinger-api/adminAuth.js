import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { pool } from "./db.js";

const router = Router();

const COOKIE_NAME = "sarine_admin_session";
const SESSION_HOURS = 8;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

function readCookie(req, name) {
  const cookies = req.headers.cookie || "";

  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_HOURS * 60 * 60 * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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

// POST /api/admin/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  res.set("Cache-Control", "no-store");

  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || email.length > 254 || !password || password.length > 256) {
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
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const passwordMatches = await bcrypt.compare(password, admin.password_hash);

  if (!passwordMatches) {
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
    await pool.execute(
      "DELETE FROM admin_sessions WHERE id = ?",
      [hashToken(token)]
    );
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