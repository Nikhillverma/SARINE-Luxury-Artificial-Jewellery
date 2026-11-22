import test from "node:test";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_NAME ||= "sarine_test";
process.env.DB_USER ||= "sarine_test";
process.env.DB_PASSWORD ||= "not-a-real-password";

const { describeActivity } = await import("../adminActivity.js");

test("describes a product update without retaining request secrets", () => {
  const event = describeActivity({
    method: "PUT",
    originalUrl: "/api/admin/products/product-123?preview=1",
    body: {
      name: "Pearl Necklace",
      password: "must-never-be-logged",
      customerEmail: "customer@example.com",
      paymentToken: "secret"
    }
  });
  assert.equal(event.entityType, "product");
  assert.equal(event.entityId, "product-123");
  assert.equal(event.action, "updated");
  assert.match(event.summary, /Pearl Necklace/);
  assert.doesNotMatch(JSON.stringify(event), /must-never-be-logged|customer@example.com|secret/);
  assert.equal(event.route, "/products/product-123");
});

test("describes order workflow actions using only the order reference", () => {
  const event = describeActivity({
    method: "POST",
    originalUrl: "/api/admin/orders/update",
    body: {
      action: "mark_shipped",
      orderNumber: "SAR-000123",
      customerPhone: "9999999999",
      address: "private customer address"
    }
  });
  assert.equal(event.entityType, "order");
  assert.equal(event.action, "mark_shipped");
  assert.equal(event.entityId, "SAR-000123");
  assert.equal(event.summary, "order mark shipped · SAR-000123");
  assert.doesNotMatch(JSON.stringify(event), /9999999999|private customer address/);
});

test("does not invent a target identifier for bulk admin actions", () => {
  const event = describeActivity({
    method: "POST",
    originalUrl: "/api/admin/products/bulk",
    body: { status: "draft", productIds: ["one", "two"] }
  });
  assert.equal(event.entityType, "product");
  assert.equal(event.entityId, null);
  assert.equal(event.summary, "product bulk updated");
});
