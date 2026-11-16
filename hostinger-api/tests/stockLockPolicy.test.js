import test from "node:test";
import assert from "node:assert/strict";
import { sortStockItems } from "../stockLockPolicy.js";

test("sorts stock reservations by parent product then variant ID", () => {
  const input = [
    { productId: "product-b", variantId: "variant-z", quantity: 1 },
    { productId: "product-a", variantId: "variant-b", quantity: 2 },
    { productId: "product-a", variantId: null, quantity: 1 },
    { productId: "product-a", variantId: "variant-a", quantity: 3 },
    { productId: "product-b", variantId: null, quantity: 1 }
  ];

  const sorted = sortStockItems(input);

  assert.deepEqual(sorted.map(item => [item.productId, item.variantId]), [
    ["product-a", null],
    ["product-a", "variant-a"],
    ["product-a", "variant-b"],
    ["product-b", null],
    ["product-b", "variant-z"]
  ]);
  assert.deepEqual(input[0], { productId: "product-b", variantId: "variant-z", quantity: 1 });
});

test("does not mutate input and preserves quantities and metadata", () => {
  const input = [
    { productId: "p2", variantId: "v2", quantity: 4, sku: "SKU-2" },
    { productId: "p1", variantId: "v1", quantity: 2, sku: "SKU-1" }
  ];

  const sorted = sortStockItems(input);

  assert.notEqual(sorted, input);
  assert.deepEqual(sorted, [input[1], input[0]]);
  assert.equal(sorted[0].quantity, 2);
  assert.equal(sorted[0].sku, "SKU-1");
});
