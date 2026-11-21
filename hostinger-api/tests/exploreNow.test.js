import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_EXPLORE_NOW,
  MAX_EXPLORE_PRODUCTS,
  validateExploreNow
} from "../exploreNowPolicy.js";

test("returns an unconfigured empty default", () => {
  assert.deepEqual(validateExploreNow(EMPTY_EXPLORE_NOW), {
    version: 1, productIds: [], displayCount: 8, configured: false
  });
});

test("accepts a unique selected product pool and display count", () => {
  assert.deepEqual(validateExploreNow({
    productIds: ["product-a", "product-b", "product-c", "product-d"],
    displayCount: 4
  }), {
    version: 1,
    productIds: ["product-a", "product-b", "product-c", "product-d"],
    displayCount: 4,
    configured: true
  });
});

test("trims product IDs", () => {
  assert.equal(validateExploreNow({ productIds: [" product-a "], displayCount: 4 }).productIds[0], "product-a");
});

test("allows an empty disabled product pool", () => {
  assert.equal(validateExploreNow({ productIds: [], displayCount: 8, configured: false }).configured, false);
});

test("rejects duplicate product IDs", () => {
  assert.throws(() => validateExploreNow({ productIds: ["same", "same"], displayCount: 4 }), /more than once/);
});

test("rejects more than the maximum number of products", () => {
  assert.throws(() => validateExploreNow({
    productIds: Array.from({ length: MAX_EXPLORE_PRODUCTS + 1 }, (_, index) => String(index)),
    displayCount: 24
  }), /no more than 100/);
});

test("rejects invalid product IDs", () => {
  assert.throws(() => validateExploreNow({ productIds: [""], displayCount: 4 }), /valid product ID/);
});

test("rejects unsupported initial display counts", () => {
  assert.throws(() => validateExploreNow({ productIds: [], displayCount: 7 }), /valid initial Explore Now product count/);
});
