import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCouponCode,
  validateCouponPayload,
  calculateCouponDiscount,
  releaseCouponRedemptionForCancelledOrder
} from "../marketingPolicy.js";

test("normalizes coupon codes consistently", () => {
  assert.equal(normalizeCouponCode("  sarine-15 "), "SARINE-15");
});

test("validates percentage coupons and applies maximum discount cap", () => {
  const coupon = validateCouponPayload({
    code: "SARINE15",
    discountType: "percentage",
    discountValue: 15,
    minOrder: 1000,
    maxDiscount: 500,
    usageLimit: 100,
    perCustomerLimit: 1,
    expiresAt: "2099-12-31T23:59:59",
    status: "active"
  });
  assert.equal(coupon.code, "SARINE15");
  assert.equal(calculateCouponDiscount({
    discount_type: coupon.discountType,
    discount_value: coupon.discountValue,
    min_order: coupon.minOrder,
    max_discount: coupon.maxDiscount
  }, 4999), 500);
});

test("calculates fixed discounts without exceeding the basket", () => {
  assert.equal(calculateCouponDiscount({
    discount_type: "fixed",
    discount_value: 250,
    min_order: 500,
    max_discount: null
  }, 700), 250);
  assert.equal(calculateCouponDiscount({
    discount_type: "fixed",
    discount_value: 900,
    min_order: 500,
    max_discount: null
  }, 700), 700);
});

test("rejects invalid percentage and malformed coupon codes", () => {
  assert.throws(() => validateCouponPayload({
    code: "NO",
    discountType: "percentage",
    discountValue: 150,
    minOrder: 0,
    expiresAt: "2099-12-31T23:59:59"
  }));
});


test("releases a reserved coupon when its order is cancelled", async () => {
  const calls = [];
  const connection = { execute: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT coupon_id")) return [[{ coupon_id: "coupon-1", status: "reserved" }]];
    return [{ affectedRows: 1 }];
  }};
  const result = await releaseCouponRedemptionForCancelledOrder(connection, "SAR-000201");
  assert.deepEqual(result, { released: true, previousStatus: "reserved" });
  assert.equal(calls.length, 3);
  assert.match(calls[1].sql, /status = 'released'/);
  assert.match(calls[2].sql, /used_count = GREATEST/);
});

test("releases a redeemed coupon when a paid or COD order is cancelled", async () => {
  let decremented = false;
  const connection = { execute: async (sql) => {
    if (sql.startsWith("SELECT coupon_id")) return [[{ coupon_id: "coupon-2", status: "redeemed" }]];
    if (sql.includes("used_count =")) decremented = true;
    return [{ affectedRows: 1 }];
  }};
  const result = await releaseCouponRedemptionForCancelledOrder(connection, "SAR-000202");
  assert.deepEqual(result, { released: true, previousStatus: "redeemed" });
  assert.equal(decremented, true);
});

test("does not decrement coupon usage twice after a redemption was released", async () => {
  let writes = 0;
  const connection = { execute: async (sql) => {
    if (sql.startsWith("SELECT coupon_id")) return [[{ coupon_id: "coupon-3", status: "released" }]];
    writes += 1;
    return [{ affectedRows: 1 }];
  }};
  const result = await releaseCouponRedemptionForCancelledOrder(connection, "SAR-000203");
  assert.deepEqual(result, { released: false, status: "released" });
  assert.equal(writes, 0);
});

test("does not write coupon usage when an order has no redemption", async () => {
  let writes = 0;
  const connection = { execute: async (sql) => {
    if (sql.startsWith("SELECT coupon_id")) return [[]];
    writes += 1;
    return [{ affectedRows: 1 }];
  }};
  const result = await releaseCouponRedemptionForCancelledOrder(connection, "SAR-000204");
  assert.deepEqual(result, { released: false, status: "missing" });
  assert.equal(writes, 0);
});
