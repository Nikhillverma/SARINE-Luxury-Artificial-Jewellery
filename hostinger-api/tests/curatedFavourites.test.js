import test from "node:test";
import assert from "node:assert/strict";
import { validateCuratedFavourites } from "../curatedFavourites.js";

test("accepts an ordered list of unique product IDs", () => {
  assert.deepEqual(validateCuratedFavourites({ productIds: ["product-a", "product-b"] }), {
    version: 1,
    productIds: ["product-a", "product-b"]
  });
});

test("trims product IDs", () => {
  assert.deepEqual(validateCuratedFavourites({ productIds: [" product-a "] }).productIds, ["product-a"]);
});

test("rejects duplicate product IDs", () => {
  assert.throws(() => validateCuratedFavourites({ productIds: ["same", "same"] }), /more than once/);
});

test("rejects more than twelve products", () => {
  assert.throws(() => validateCuratedFavourites({ productIds: Array.from({ length: 13 }, (_, i) => String(i)) }), /no more than 12/);
});

test("rejects invalid product IDs", () => {
  assert.throws(() => validateCuratedFavourites({ productIds: [""] }), /valid product ID/);
});
