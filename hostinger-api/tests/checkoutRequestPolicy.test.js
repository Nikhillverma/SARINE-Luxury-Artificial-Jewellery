import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CHECKOUT_LINES,
  MAX_CHECKOUT_QUANTITY_PER_LINE,
  validateCheckoutItems
} from "../checkoutRequestPolicy.js";

test("accepts a normal cart and numeric-string quantities", () => {
  assert.equal(validateCheckoutItems([
    { productId: "product-1", quantity: 1 },
    { productId: "product-2", quantity: "2" }
  ]), null);
});

test("rejects an empty or non-array cart", () => {
  assert.equal(validateCheckoutItems([]), "Your shopping bag is empty.");
  assert.equal(validateCheckoutItems(null), "Your shopping bag is empty.");
});

test("rejects carts with too many lines before checkout work begins", () => {
  const items = Array.from({ length: MAX_CHECKOUT_LINES + 1 }, (_, index) => ({
    productId: `product-${index}`, quantity: 1
  }));
  assert.match(validateCheckoutItems(items), /at most/);
});

test("accepts the configured maximum line count", () => {
  const items = Array.from({ length: MAX_CHECKOUT_LINES }, (_, index) => ({
    productId: `product-${index}`, quantity: 1
  }));
  assert.equal(validateCheckoutItems(items), null);
});

test("rejects malformed product references and sparse/null entries", () => {
  assert.equal(validateCheckoutItems([null]), "Invalid product in order list.");
  assert.equal(validateCheckoutItems([{ productId: " ", quantity: 1 }]), "Invalid product in order list.");
  assert.equal(validateCheckoutItems([{ productId: "x".repeat(192), quantity: 1 }]), "Invalid product in order list.");
});

test("rejects zero, negative, fractional, unsafe, and excessive quantities", () => {
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, MAX_CHECKOUT_QUANTITY_PER_LINE + 1, "not-a-number"]) {
    assert.match(validateCheckoutItems([{ productId: "product-1", quantity }]), /quantity must be/);
  }
});

test("accepts the configured maximum quantity per line", () => {
  assert.equal(validateCheckoutItems([
    { productId: "product-1", quantity: MAX_CHECKOUT_QUANTITY_PER_LINE }
  ]), null);
});
