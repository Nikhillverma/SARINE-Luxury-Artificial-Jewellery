import test from "node:test";
import assert from "node:assert/strict";
import { validateBulkProductRequest } from "../bulkProductPolicy.js";

test("accepts bounded unique product selections and supported updates", () => {
  assert.equal(validateBulkProductRequest(["p1", "p2"], { price: 1299, status: "draft" }), null);
});

test("rejects empty, oversized and duplicate selections", () => {
  assert.match(validateBulkProductRequest([], { price: 10 }), /Select between/);
  assert.match(validateBulkProductRequest(Array.from({ length: 101 }, (_, i) => String(i)), { price: 10 }), /Select between/);
  assert.match(validateBulkProductRequest(["p1", "p1"], { price: 10 }), /Duplicate/);
});

test("rejects unsafe stock/name and unknown field changes", () => {
  assert.match(validateBulkProductRequest(["p1"], { stock: 99 }), /unsupported field/);
  assert.match(validateBulkProductRequest(["p1"], { name: "Changed" }), /unsupported field/);
});

test("validates money, category and publication status", () => {
  assert.match(validateBulkProductRequest(["p1"], { price: -1 }), /Selling price/);
  assert.match(validateBulkProductRequest(["p1"], { compareAtPrice: "1500" }), /Comparison price/);
  assert.match(validateBulkProductRequest(["p1"], { categoryId: "" }), /category/);
  assert.match(validateBulkProductRequest(["p1"], { status: "archived" }), /active or draft/);
  assert.equal(validateBulkProductRequest(["p1"], { compareAtPrice: null }), null);
});
