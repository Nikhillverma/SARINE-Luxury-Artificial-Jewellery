import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateShippingFee,
  SHIPPING_FLAT_FEE,
  FREE_SHIPPING_THRESHOLD,
  COD_ENABLED
} from "../checkoutPolicy.js";

test("charges the flat shipping fee below the free-shipping threshold", () => {
  assert.equal(calculateShippingFee(0), SHIPPING_FLAT_FEE);
  assert.equal(calculateShippingFee(1998), SHIPPING_FLAT_FEE);
});

test("free shipping starts at the configured threshold", () => {
  assert.equal(calculateShippingFee(FREE_SHIPPING_THRESHOLD), 0);
  assert.equal(calculateShippingFee(2500), 0);
});

test("checkout policy retains COD and the SARINE free-shipping threshold", () => {
  assert.equal(SHIPPING_FLAT_FEE, 99);
  assert.equal(FREE_SHIPPING_THRESHOLD, 1999);
  assert.equal(COD_ENABLED, true);
});

test("shipping calculation accepts persisted checkout settings", () => {
  const custom = { shippingFlatFee: 49, freeShippingThreshold: 1000, codEnabled: false };
  assert.equal(calculateShippingFee(999, custom), 49);
  assert.equal(calculateShippingFee(1000, custom), 0);
});
