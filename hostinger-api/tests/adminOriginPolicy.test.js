import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedBrowserOrigin } from "../adminOriginPolicy.js";

const allowed = new Set(["https://lavender-emu-732118.hostingersite.com", "http://localhost:5173"]);

test("allows the configured storefront origin", () => {
  assert.equal(isAllowedBrowserOrigin("https://lavender-emu-732118.hostingersite.com", allowed), true);
});

test("rejects untrusted, null, malformed, and lookalike origins", () => {
  for (const origin of ["https://attacker.example", "null", "https://lavender-emu-732118.hostingersite.com.attacker.example", 42]) {
    assert.equal(isAllowedBrowserOrigin(origin, allowed), false);
  }
});

test("allows requests without Origin for non-browser clients", () => {
  assert.equal(isAllowedBrowserOrigin(undefined, allowed), true);
  assert.equal(isAllowedBrowserOrigin("", allowed), true);
});
