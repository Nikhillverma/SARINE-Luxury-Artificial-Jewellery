import test from "node:test";
import assert from "node:assert/strict";
import { shouldUseSecureSessionCookie } from "../sessionCookiePolicy.js";

test("session cookies are Secure in production", () => {
  assert.equal(shouldUseSecureSessionCookie("production"), true);
});

test("session cookies default to Secure when NODE_ENV is unset", () => {
  assert.equal(shouldUseSecureSessionCookie(undefined), true);
});

test("plain HTTP cookies are permitted only in explicit local development", () => {
  assert.equal(shouldUseSecureSessionCookie("development"), false);
  assert.equal(shouldUseSecureSessionCookie("test"), true);
});
