import test from "node:test";
import assert from "node:assert/strict";
import { dateBoundary } from "./adminActivityDate.js";

test("parses valid dates at India Standard Time midnight", () => {
  assert.equal(dateBoundary("2026-11-27"), "2026-11-26 18:30:00");
});

test("uses an exclusive next-day boundary for the selected end date", () => {
  assert.equal(dateBoundary("2026-11-27", true), "2026-11-27 18:30:00");
});

test("rejects malformed and impossible calendar dates", () => {
  assert.equal(dateBoundary("27-11-2026"), null);
  assert.equal(dateBoundary("2026-02-30"), null);
  assert.equal(dateBoundary("2026-13-01"), null);
  assert.equal(dateBoundary(""), null);
  assert.equal(dateBoundary(null), null);
});
