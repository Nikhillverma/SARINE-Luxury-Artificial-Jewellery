import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_COLLECTIONS,
  normalizeProductCollection,
  validateProductCollection
} from "../productCollectionPolicy.js";

test("supports exactly the two SARINE product collections", () => {
  assert.deepEqual(PRODUCT_COLLECTIONS, ["artificial", "demi-fine"]);
  assert.equal(normalizeProductCollection(" Artificial "), "artificial");
  assert.equal(normalizeProductCollection("DEMI-FINE"), "demi-fine");
});

test("requires a collection for new products", () => {
  assert.match(validateProductCollection(undefined, { required: true }), /Choose Artificial or Demi-Fine/);
  assert.equal(validateProductCollection("artificial", { required: true }), null);
  assert.equal(validateProductCollection("demi-fine", { required: true }), null);
});

test("rejects unknown collections without altering legacy records", () => {
  assert.match(validateProductCollection("fine-jewellery"), /must be artificial or demi-fine/);
  assert.equal(validateProductCollection(null), null);
  assert.equal(validateProductCollection(undefined), null);
});
