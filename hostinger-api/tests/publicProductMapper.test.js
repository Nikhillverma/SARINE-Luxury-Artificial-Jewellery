import test from "node:test";
import assert from "node:assert/strict";
import { mapPublicProduct } from "../publicProductMapper.js";

test("public product mapping never exposes internal cost price", () => {
  const product = mapPublicProduct({
    id: "product-1", slug: "silver-hoops", name: "Silver Hoops",
    description: "Everyday hoops", short_description: "Lightweight",
    price: "1499.00", compare_at_price: "1799.00", cost_price: "420.00",
    images: '["front.webp"]', category_id: "earrings",
    collection_slugs: '["new-arrivals"]', jewellery_type: "hoops",
    stock: 12, status: "active", tags: '["daily-wear"]',
    base_metal: "alloy", plating_finish: "gold", stone_type: null,
    closure_type: "hinge", care_instructions: '["Keep dry"]',
    created_at: "2026-11-17T00:00:00.000Z"
  });
  assert.equal(product.price, 1499);
  assert.equal(product.compareAtPrice, 1799);
  assert.equal(product.name, "Silver Hoops");
  assert.deepEqual(product.images, ["front.webp"]);
  assert.equal(Object.hasOwn(product, "costPrice"), false);
  assert.equal(JSON.stringify(product).includes("420"), false);
});

test("public product mapping retains safe defaults for malformed JSON columns", () => {
  const product = mapPublicProduct({ images: "{bad", collection_slugs: null, tags: null, care_instructions: null });
  assert.deepEqual(product.images, []);
  assert.deepEqual(product.collectionSlugs, []);
  assert.deepEqual(product.tags, []);
  assert.deepEqual(product.careInstructions, []);
});
