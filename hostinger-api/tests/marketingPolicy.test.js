import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCouponCode,
  validateCouponPayload,
  calculateCouponDiscount
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
