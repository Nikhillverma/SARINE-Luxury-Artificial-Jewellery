import test from "node:test";
import assert from "node:assert/strict";
import { aggregateOrderItems } from "../orderItems.js";

test("preserves distinct product lines", () => {
  assert.deepEqual(
    aggregateOrderItems([
      { productId: "prod-1", quantity: 2 },
      { productId: "prod-2", quantity: 1 }
    ]),
    [
      { productId: "prod-1", quantity: 2 },
      { productId: "prod-2", quantity: 1 }
    ]
  );
});

test("combines repeated product IDs before stock checks", () => {
  assert.deepEqual(
    aggregateOrderItems([
      { productId: "prod-1", quantity: 2 },
      { productId: "prod-1", quantity: 3 },
      { productId: "prod-2", quantity: 1 }
    ]),
    [
      { productId: "prod-1", quantity: 5 },
      { productId: "prod-2", quantity: 1 }
    ]
  );
});

test("rejects an unsafe combined quantity", () => {
  assert.throws(
    () => aggregateOrderItems([
      { productId: "prod-1", quantity: Number.MAX_SAFE_INTEGER },
      { productId: "prod-1", quantity: 1 }
    ]),
    RangeError
  );
});
