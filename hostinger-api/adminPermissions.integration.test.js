import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { requireAdminPermission } from "./adminPermissions.js";

// This Express harness exercises the real permission middleware at the same
// /api/admin mount point used by server.js. Authentication is stubbed because
// these tests target authorization boundaries, not the production session DB.
test("admin permission middleware enforces role boundaries through Express mounts", async (t) => {
  const app = express();
  app.use("/api/admin", (req, _res, next) => {
    req.admin = { id: "integration-test-admin", role: req.get("x-test-admin-role") || "" };
    next();
  });
  app.use("/api/admin", requireAdminPermission);

  const routes = [
    ["get", "/api/admin/dashboard"],
    ["get", "/api/admin/analytics"],
    ["get", "/api/admin/orders"],
    ["patch", "/api/admin/orders"],
    ["get", "/api/admin/returns"],
    ["patch", "/api/admin/returns/123"],
    ["get", "/api/admin/refunds"],
    ["get", "/api/admin/inventory-settings"],
    ["put", "/api/admin/inventory-settings"],
    ["get", "/api/admin/categories"],
    ["post", "/api/admin/categories"],
    ["get", "/api/admin/media"],
    ["post", "/api/admin/media"],
    ["get", "/api/admin/customers"],
    ["get", "/api/admin/products"],
    ["post", "/api/admin/products"],
    ["get", "/api/admin/customer-auth/security"],
    ["get", "/api/admin/database-audit"],
    ["post", "/api/admin/marketing/coupons"],
    ["put", "/api/admin/storefront/announcement"],
    ["put", "/api/admin/homepage-layout"],
    ["put", "/api/admin/curated-favourites"],
    ["put", "/api/admin/explore-now"],
    ["post", "/api/admin/pages"],
    ["get", "/api/admin/contact-inquiries/123"],
    ["patch", "/api/admin/contact-inquiries/123"],
    ["get", "/api/admin/auth/admins"],
    ["get", "/api/admin/activity"],
    ["get", "/api/admin/unmapped-sensitive-route"]
  ];
  for (const [method, path] of routes) {
    app[method](path, (_req, res) => res.status(200).json({ allowed: true }));
  }

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (role, path, method = "GET") => fetch(`${base}${path}`, {
    method,
    headers: { "x-test-admin-role": role }
  });

  // Support staff: read-only operational visibility.
  assert.equal((await call("support_staff", "/api/admin/dashboard")).status, 200);
  assert.equal((await call("support_staff", "/api/admin/customers")).status, 200);
  assert.equal((await call("support_staff", "/api/admin/contact-inquiries/123")).status, 200);
  assert.equal((await call("support_staff", "/api/admin/orders")).status, 200);
  assert.equal((await call("support_staff", "/api/admin/orders", "PATCH")).status, 403);
  assert.equal((await call("support_staff", "/api/admin/customer-auth/security")).status, 403);

  // Operations: fulfilment and customer operations, but not marketing or auth diagnostics.
  assert.equal((await call("operations_manager", "/api/admin/analytics")).status, 200);
  assert.equal((await call("operations_manager", "/api/admin/returns")).status, 200);
  assert.equal((await call("operations_manager", "/api/admin/refunds")).status, 200);
  assert.equal((await call("operations_manager", "/api/admin/inventory-settings", "PUT")).status, 200);
  assert.equal((await call("operations_manager", "/api/admin/orders", "PATCH")).status, 200);
  assert.equal((await call("operations_manager", "/api/admin/contact-inquiries/123", "PATCH")).status, 200);
  assert.equal((await call("operations_manager", "/api/admin/marketing/coupons", "POST")).status, 403);
  assert.equal((await call("operations_manager", "/api/admin/customer-auth/security")).status, 403);

  // Catalogue: catalogue maintenance, not order access.
  assert.equal((await call("catalogue_manager", "/api/admin/categories", "POST")).status, 200);
  assert.equal((await call("catalogue_manager", "/api/admin/media", "POST")).status, 200);
  assert.equal((await call("catalogue_manager", "/api/admin/products", "POST")).status, 200);
  assert.equal((await call("catalogue_manager", "/api/admin/inventory-settings", "PUT")).status, 403);
  assert.equal((await call("catalogue_manager", "/api/admin/orders")).status, 403);

  // Marketing: promotions and storefront content, not operational or privileged APIs.
  assert.equal((await call("marketing_manager", "/api/admin/pages", "POST")).status, 200);
  assert.equal((await call("marketing_manager", "/api/admin/homepage-layout", "PUT")).status, 200);
  assert.equal((await call("marketing_manager", "/api/admin/curated-favourites", "PUT")).status, 200);
  assert.equal((await call("marketing_manager", "/api/admin/explore-now", "PUT")).status, 200);
  assert.equal((await call("marketing_manager", "/api/admin/marketing/coupons", "POST")).status, 200);
  assert.equal((await call("marketing_manager", "/api/admin/storefront/announcement", "PUT")).status, 200);
  assert.equal((await call("marketing_manager", "/api/admin/customer-auth/security")).status, 403);

  // The existing legacy role retains Owner access; Owner-only routes remain restricted.
  for (const role of ["admin", "owner"]) {
    for (const path of [
      "/api/admin/auth/admins",
      "/api/admin/activity",
      "/api/admin/database-audit",
      "/api/admin/customer-auth/security",
      "/api/admin/unmapped-sensitive-route"
    ]) {
      assert.equal((await call(role, path)).status, 200, `${role} should access ${path}`);
    }
  }

  // Unknown roles and unclassified endpoints fail closed.
  assert.equal((await call("unknown_role", "/api/admin/orders")).status, 403);
  assert.equal((await call("support_staff", "/api/admin/unmapped-sensitive-route")).status, 403);
});
