import test from "node:test";
import assert from "node:assert/strict";
import {
  formatVariantLabel,
  isValidVariantSku,
  validateVariantSelection,
  getVariantStockKey
} from "../productVariantPolicy.js";

test("formats one-option and two-option variant labels", () => {
  assert.equal(formatVariantLabel("Size", "6", null, null), "Size: 6");
  assert.equal(formatVariantLabel("Size", "6", "Colour", "Rose Gold"), "Size: 6 / Colour: Rose Gold");
  assert.equal(formatVariantLabel("Size", " 6 ", "Colour", " "), "Size: 6");
});

test("accepts safe unique-SKU character format and rejects invalid values", () => {
  assert.equal(isValidVariantSku("SAR-RING-06-GD"), true);
  assert.equal(isValidVariantSku("AB_06.2"), true);
  assert.equal(isValidVariantSku("A"), false);
  assert.equal(isValidVariantSku("SKU WITH SPACE"), false);
  assert.equal(isValidVariantSku(""), false);
});

test("requires a selected variant only when active variants exist", () => {
  assert.match(validateVariantSelection(true, ""), /choose an available product option/i);
  assert.equal(validateVariantSelection(true, "variant-1"), null);
  assert.match(validateVariantSelection(false, "variant-1"), /no longer available/i);
  assert.equal(validateVariantSelection(false, undefined), null);
});

test("keeps stock reservations distinct for variants and legacy products", () => {
  assert.equal(getVariantStockKey("prod-1", "variant-1"), "variant:variant-1");
  assert.equal(getVariantStockKey("prod-1", null), "product:prod-1");
});
