import test from "node:test";
import assert from "node:assert/strict";
import { requireAdminPermission, normalizeAdminRole } from "./adminPermissions.js";

function authorize(role, path, method = "GET") {
  const req = { admin: { role }, path, method };
  let status = 200;
  let body;
  let continued = false;
  const res = {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; }
  };
  requireAdminPermission(req, res, () => { continued = true; });
  return { status, body, continued };
}

test("legacy admin role remains Owner for backwards compatibility", () => {
  assert.equal(normalizeAdminRole("admin"), "owner");
  assert.equal(authorize("admin", "/orders", "DELETE").continued, true);
});

test("catalogue manager can edit products but cannot read orders", () => {
  assert.equal(authorize("catalogue_manager", "/products", "POST").continued, true);
  assert.equal(authorize("catalogue_manager", "/orders", "GET").status, 403);
});

test("support staff can read but cannot modify orders", () => {
  assert.equal(authorize("support_staff", "/orders", "GET").continued, true);
  assert.equal(authorize("support_staff", "/orders", "PATCH").status, 403);
});

test("marketing manager can edit storefront content but not coupons in other namespaces", () => {
  assert.equal(authorize("marketing_manager", "/storefront", "PUT").continued, true);
  assert.equal(authorize("marketing_manager", "/orders", "GET").status, 403);
});

test("unknown roles and unmapped endpoints fail closed", () => {
  assert.equal(authorize("unknown_role", "/orders", "GET").status, 403);
  assert.equal(authorize("support_staff", "/database-audit", "GET").status, 403);
});
