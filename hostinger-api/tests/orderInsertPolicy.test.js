import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderInsert } from "../orderInsertPolicy.js";

const order = {
  orderNumber: "SAR-000999",
  customerId: null,
  customerName: "Test Customer",
  customerEmail: "test@example.com",
  customerPhone: "9876543210",
  shippingAddress: JSON.stringify({ city: "Kanpur" }),
  subtotal: 2000,
  shippingFee: 0,
  total: 1750,
  couponCode: "TEST250",
  discountAmount: 250,
  publicTokenHash: "test-token-hash"
};

for (const paymentMethod of ["cod", "online"]) {
  test(`${paymentMethod.toUpperCase()} order insert has one value for every SQL placeholder`, () => {
    const { sql, values } = buildOrderInsert({ ...order, paymentMethod });

    assert.equal((sql.match(/\?/g) || []).length, values.length);
    assert.equal(values.length, 13);
    assert.deepEqual(values.slice(10), ["TEST250", 250, "test-token-hash"]);
    assert.match(sql, new RegExp(`'${paymentMethod}'`));
    assert.match(sql, paymentMethod === "cod" ? /'placed'/ : /'awaiting_payment'/);
  });
}

test("order insert rejects unsupported payment methods", () => {
  assert.throws(
    () => buildOrderInsert({ ...order, paymentMethod: "cash" }),
    /Unsupported order payment method/
  );
});
