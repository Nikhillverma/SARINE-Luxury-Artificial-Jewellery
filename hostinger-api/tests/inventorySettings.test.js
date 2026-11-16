import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOW_STOCK_THRESHOLD, validateLowStockThreshold } from "../inventorySettingsPolicy.js";

test("uses five units as the default low-stock threshold", () => {
  assert.equal(DEFAULT_LOW_STOCK_THRESHOLD, 5);
});

test("accepts whole-number thresholds including zero", () => {
  assert.deepEqual(validateLowStockThreshold(0), { valid: true, value: 0 });
  assert.deepEqual(validateLowStockThreshold("12"), { valid: true, value: 12 });
});

test("rejects negative, fractional, non-numeric and excessive thresholds", () => {
  for (const value of [-1, 1.5, "abc", 10001, null]) {
    assert.equal(validateLowStockThreshold(value).valid, false);
  }
});
