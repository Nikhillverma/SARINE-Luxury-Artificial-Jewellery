import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCustomerEmail } from "../customerValidation.js";

test("normalizes valid customer emails", () => {
  assert.equal(normalizeCustomerEmail("  BUYER@Example.com "), "buyer@example.com");
});

test("rejects invalid or oversized customer emails", () => {
  assert.equal(normalizeCustomerEmail("not-an-email"), "");
  assert.equal(normalizeCustomerEmail(""), "");
  assert.equal(normalizeCustomerEmail("x".repeat(250) + "@example.com"), "");
  assert.equal(normalizeCustomerEmail(null), "");
});
