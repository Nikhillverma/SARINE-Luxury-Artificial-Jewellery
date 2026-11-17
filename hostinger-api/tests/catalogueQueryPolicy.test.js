import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CATALOGUE_PAGE, MAX_CATALOGUE_PAGE_SIZE, MAX_CATALOGUE_SEARCH_LENGTH, parseCatalogueQuery } from "../catalogueQueryPolicy.js";

test("applies safe defaults and preserves supported filters", () => {
  const result = parseCatalogueQuery({ categorySlug: "earrings", jewelleryType: "studs", inStockOnly: "true", sortBy: "price-asc" });
  assert.equal(result.error, null);
  assert.deepEqual(result.filters, { categorySlug: "earrings", categoryId: undefined, jewelleryType: "studs", collectionSlug: undefined, search: undefined, page: 1, pageSize: 24, minPrice: undefined, maxPrice: undefined, inStockOnly: true, sortBy: "price-asc" });
});

test("accepts the maximum bounded pagination values", () => {
  const result = parseCatalogueQuery({ page: String(MAX_CATALOGUE_PAGE), pageSize: String(MAX_CATALOGUE_PAGE_SIZE) });
  assert.equal(result.error, null);
  assert.equal(result.filters.page, MAX_CATALOGUE_PAGE);
  assert.equal(result.filters.pageSize, MAX_CATALOGUE_PAGE_SIZE);
});

test("rejects malformed, repeated, fractional, and excessive pagination values", () => {
  for (const page of ["0", "-1", "1.5", "1e6", "10001", ["1", "2"]]) assert.match(parseCatalogueQuery({ page }).error, /page/);
  for (const pageSize of ["0", "101", "2.5", ["24", "100"]]) assert.match(parseCatalogueQuery({ pageSize }).error, /pageSize/);
});

test("bounds search and text filter lengths and rejects repeated parameters", () => {
  assert.match(parseCatalogueQuery({ search: "x".repeat(MAX_CATALOGUE_SEARCH_LENGTH + 1) }).error, /search/);
  assert.match(parseCatalogueQuery({ categorySlug: ["rings", "earrings"] }).error, /categorySlug/);
  assert.equal(parseCatalogueQuery({ search: "  gold ring  " }).filters.search, "gold ring");
});

test("validates non-negative whole-number price filters and their relationship", () => {
  assert.equal(parseCatalogueQuery({ minPrice: "0", maxPrice: "2500" }).error, null);
  for (const minPrice of ["-1", "1.5", "1e3", "999999999999999999"]) assert.match(parseCatalogueQuery({ minPrice }).error, /minPrice/);
  assert.match(parseCatalogueQuery({ minPrice: "3000", maxPrice: "2000" }).error, /Minimum price/);
});

test("uses a safe sort fallback for unknown or repeated sort values", () => {
  assert.equal(parseCatalogueQuery({ sortBy: "arbitrary-sql" }).filters.sortBy, "newest");
  assert.equal(parseCatalogueQuery({ sortBy: ["newest", "price-asc"] }).filters.sortBy, "newest");
});
