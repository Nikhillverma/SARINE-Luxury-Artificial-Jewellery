import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import adminAuthRouter, { hashToken, requireAdminAuth } from "./adminAuth.js";
import { requireAdminPermission } from "./adminPermissions.js";
import { pool } from "./db.js";

const OWNER_ID = "integration-owner";
const OWNER_EMAIL = "owner@example.test";
const OWNER_PASSWORD = "Integration-Owner-Password-2026!";
const OWNER_TOKEN = crypto.randomBytes(32).toString("hex");

async function prepareDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS admins (
    id varchar(191) NOT NULL PRIMARY KEY,
    email varchar(254) NOT NULL,
    email_normalized varchar(254) NOT NULL UNIQUE,
    name varchar(255) NULL,
    password_hash varchar(255) NOT NULL,
    role varchar(40) NOT NULL DEFAULT 'admin',
    status enum('active','disabled') NOT NULL DEFAULT 'active',
    created_at datetime(3) NULL,
    updated_at datetime(3) NULL,
    last_login_at datetime(3) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_sessions (
    id varchar(191) NOT NULL PRIMARY KEY,
    admin_id varchar(191) NOT NULL,
    expires_at datetime(3) NOT NULL,
    last_used_at datetime(3) NULL,
    INDEX idx_admin_sessions_admin_id (admin_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    admin_id varchar(64) NOT NULL,
    admin_name varchar(160) NOT NULL,
    admin_email varchar(254) NOT NULL,
    action varchar(100) NOT NULL,
    entity_type varchar(80) NOT NULL,
    entity_id varchar(190) NULL,
    summary varchar(500) NOT NULL,
    http_method varchar(10) NOT NULL,
    route varchar(255) NOT NULL,
    status_code int NOT NULL,
    created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query("DELETE FROM admin_activity_logs");
  await pool.query("DELETE FROM admin_sessions");
  await pool.query("DELETE FROM admins");
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 4);
  await pool.execute(
    `INSERT INTO admins
      (id,email,email_normalized,name,password_hash,role,status,created_at,updated_at)
     VALUES (?,?,?,?,?,'admin','active',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3))`,
    [OWNER_ID, OWNER_EMAIL, OWNER_EMAIL, "Integration Owner", passwordHash]
  );
  await pool.execute(
    "INSERT INTO admin_sessions (id,admin_id,expires_at) VALUES (?,?,DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 1 HOUR))",
    [hashToken(OWNER_TOKEN), OWNER_ID]
  );
}

test("admin account CRUD, login, persisted role authorization and session revocation work against MySQL", async (t) => {
  await prepareDatabase();

  const app = express();
  app.use(express.json());
  app.use("/api/admin", (req, res, next) => {
    if (["/auth/login", "/auth/session", "/auth/logout"].includes(req.path)) return next();
    return requireAdminAuth(req, res, () => requireAdminPermission(req, res, next));
  });
  app.use("/api/admin/auth", adminAuthRouter);
  app.get("/api/admin/orders", (_req, res) => res.json({ ok: true }));
  app.patch("/api/admin/orders", (_req, res) => res.json({ ok: true }));

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const ownerHeaders = {
    authorization: `Bearer ${OWNER_TOKEN}`,
    "content-type": "application/json"
  };
  const create = await fetch(`${base}/api/admin/auth/admins`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      name: "Test Support",
      email: "support@example.test",
      password: "Support-Password-2026!",
      role: "support_staff"
    })
  });
  assert.equal(create.status, 201);
  const created = await create.json();

  const [storedRows] = await pool.execute(
    "SELECT id,email_normalized,password_hash,role,status FROM admins WHERE id = ?",
    [created.id]
  );
  assert.equal(storedRows.length, 1);
  assert.equal(storedRows[0].role, "support_staff");
  assert.equal(storedRows[0].status, "active");
  assert.equal(storedRows[0].email_normalized, "support@example.test");
  assert.equal(await bcrypt.compare("Support-Password-2026!", storedRows[0].password_hash), true);

  const duplicate = await fetch(`${base}/api/admin/auth/admins`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      name: "Duplicate", email: "SUPPORT@example.test",
      password: "Another-Password-2026!", role: "support_staff"
    })
  });
  assert.equal(duplicate.status, 409);

  const attemptedOwner = await fetch(`${base}/api/admin/auth/admins`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      name: "Extra Owner", email: "extra@example.test",
      password: "Another-Password-2026!", role: "owner"
    })
  });
  assert.equal(attemptedOwner.status, 400);

  const login = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "support@example.test", password: "Support-Password-2026!" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "login should issue a session cookie");

  const supportHeaders = { cookie };
  assert.equal((await fetch(`${base}/api/admin/orders`, { headers: supportHeaders })).status, 200);
  assert.equal((await fetch(`${base}/api/admin/orders`, { method: "PATCH", headers: supportHeaders })).status, 403);

  const promote = await fetch(`${base}/api/admin/auth/admins/${created.id}`, {
    method: "PATCH",
    headers: ownerHeaders,
    body: JSON.stringify({ role: "operations_manager" })
  });
  assert.equal(promote.status, 200);
  assert.equal((await fetch(`${base}/api/admin/orders`, { method: "PATCH", headers: supportHeaders })).status, 200);

  const protectOwner = await fetch(`${base}/api/admin/auth/admins/${OWNER_ID}`, {
    method: "PATCH",
    headers: ownerHeaders,
    body: JSON.stringify({ role: "catalogue_manager" })
  });
  assert.equal(protectOwner.status, 403);

  const disable = await fetch(`${base}/api/admin/auth/admins/${created.id}`, {
    method: "PATCH",
    headers: ownerHeaders,
    body: JSON.stringify({ status: "disabled" })
  });
  assert.equal(disable.status, 200);
  const [remainingSessions] = await pool.execute(
    "SELECT id FROM admin_sessions WHERE admin_id = ?", [created.id]
  );
  assert.equal(remainingSessions.length, 0);
  assert.equal((await fetch(`${base}/api/admin/orders`, { headers: supportHeaders })).status, 401);

  const [ownerRows] = await pool.execute("SELECT role,status FROM admins WHERE id = ?", [OWNER_ID]);
  assert.equal(ownerRows[0].role, "admin");
  assert.equal(ownerRows[0].status, "active");
});
