import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStringList, validateProductFields } from "../productPolicy.js";

test("accepts valid product storytelling and craftsmanship fields", () => {
  assert.deepEqual(validateProductFields({
    shortDescription: "A refined festive statement piece.",
    description: "Hand-finished details.",
    compareAtPrice: 1799,
    price: 1299,
    tags: ["festive", "kundan"],
    collectionSlugs: ["heritage"],
    baseMetal: "Brass",
    platingFinish: "18K gold-tone",
    stoneType: "Kundan glass stones",
    closureType: "Adjustable dori",
    careInstructions: ["Keep dry", "Store separately"]
  }), []);
});

test("allows explicitly clearing comparison price", () => {
  assert.deepEqual(validateProductFields({ compareAtPrice: null }), []);
});

test("rejects comparison prices at or below selling price", () => {
  assert.match(validateProductFields({ price: 1200, compareAtPrice: 1200 }).join(" "), /higher than the selling price/);
});

test("rejects oversized text and excessive list values", () => {
  const errors = validateProductFields({
    shortDescription: "x".repeat(241),
    tags: Array.from({ length: 21 }, (_, index) => "tag-" + index)
  });
  assert.equal(errors.length, 2);
});

test("normalizes product lists by trimming, dropping blanks and deduplicating", () => {
  assert.deepEqual(normalizeStringList([" kundan ", "", "festive", "kundan"]), ["kundan", "festive"]);
});
