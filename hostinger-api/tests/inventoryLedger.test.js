import test from "node:test";
import assert from "node:assert/strict";

// The schema modules construct a lazy pool at import time; these test-only
// values ensure the pool can be created without connecting to any database.
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_NAME ||= "sarine_test";
process.env.DB_USER ||= "sarine_test";
process.env.DB_PASSWORD ||= "test-only";

const { recordInventoryMovement } = await import("../inventoryLedger.js");
const { recordVariantInventoryMovement } = await import("../productVariantSchema.js");

test("records a product stock movement with a matching balance delta", async () => {
  const calls = [];
  const connection = { execute: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT cost_price")) return [[{ cost_price: "110.00" }]];
    return [{ affectedRows: 1 }];
  }};

  const movement = await recordInventoryMovement(connection, {
    productId: "product-1",
    productName: "Test Pendant",
    previousStock: 5,
    quantityDelta: -2,
    newStock: 3,
    reason: "COD order placed SAR-000999",
    actorName: "Customer checkout",
    actorEmail: "system@sarine.local"
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /SELECT cost_price FROM products/);
  assert.match(calls[1].sql, /INSERT INTO inventory_movements/);
  assert.equal(calls[1].values[7], 5);
  assert.equal(calls[1].values[8], -2);
  assert.equal(calls[1].values[9], 3);
  assert.equal(calls[1].values[11], 110);
  assert.equal(calls[1].values[12], 550);
  assert.equal(calls[1].values[13], 330);
  assert.equal(movement.previousStock + movement.quantityDelta, movement.newStock);
});

test("records variant opening stock as an auditable positive movement", async () => {
  const calls = [];
  const connection = { execute: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT cost_price")) return [[{ cost_price: "200.00" }]];
    return [{ affectedRows: 1 }];
  }};

  const movement = await recordVariantInventoryMovement(connection, {
    variantId: "variant-1",
    productId: "product-1",
    productName: "Test Cuff",
    variantSku: "SAR-TEST-SM-RG",
    variantLabel: "Size: Small / Colour: Rose Gold",
    previousStock: 0,
    quantityDelta: 3,
    newStock: 3,
    reason: "Initial variant stock",
    adminName: "Atelier admin",
    adminEmail: "admin@example.test"
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /SELECT cost_price FROM products/);
  assert.match(calls[1].sql, /INSERT INTO variant_inventory_movements/);
  assert.equal(calls[1].values[9], 0);
  assert.equal(calls[1].values[10], 3);
  assert.equal(calls[1].values[11], 3);
  assert.equal(calls[1].values[12], "Initial variant stock");
  assert.equal(calls[1].values[13], 200);
  assert.equal(calls[1].values[14], 0);
  assert.equal(calls[1].values[15], 600);
  assert.equal(movement.previousStock + movement.quantityDelta, movement.newStock);
});
