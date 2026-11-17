import test from "node:test";
import assert from "node:assert/strict";
import { isValidPublicOrderToken } from "../orderAccessPolicy.js";

test("accepts a 32-byte hexadecimal public order token", () => {
  assert.equal(isValidPublicOrderToken("a".repeat(64)), true);
  assert.equal(isValidPublicOrderToken("A1".repeat(32)), true);
});

test("rejects missing, malformed, short, and oversized public order tokens", () => {
  for (const value of [undefined, null, "", "a".repeat(63), "a".repeat(65), "g".repeat(64), 123]) {
    assert.equal(isValidPublicOrderToken(value), false);
  }
});
