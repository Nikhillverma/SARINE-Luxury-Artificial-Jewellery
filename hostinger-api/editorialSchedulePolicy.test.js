import test from "node:test";
import assert from "node:assert/strict";
import {
  createEditorialSchedule,
  getEditorialScheduleStatus,
  getEffectiveEditorial,
  normalizeEditorialSchedule
} from "./editorialSchedulePolicy.js";

const now = new Date("2026-11-26T12:00:00.000Z");
const draft = { title: "Winter edit", active: true };
const published = { title: "Current edit", active: true };

test("creates a future schedule and retains the previous published snapshot", () => {
  const schedule = createEditorialSchedule({
    startsAtUtc: "2026-11-26T13:00:00.000Z",
    endsAtUtc: "2026-11-27T13:00:00.000Z"
  }, draft, published, now);
  assert.equal(schedule.content, draft);
  assert.equal(schedule.previousPublished, published);
  assert.equal(getEditorialScheduleStatus(schedule, now), "scheduled");
});

test("rejects a start time that is not in the future", () => {
  assert.throws(() => createEditorialSchedule({
    startsAtUtc: "2026-11-26T12:00:00.000Z"
  }, draft, published, now), /future publication/);
});

test("rejects an expiry time before the start time", () => {
  assert.throws(() => createEditorialSchedule({
    startsAtUtc: "2026-11-26T13:00:00.000Z",
    endsAtUtc: "2026-11-26T12:30:00.000Z"
  }, draft, published, now), /later than publication/);
});

test("serves the scheduled snapshot only inside its publication window", () => {
  const schedule = createEditorialSchedule({
    startsAtUtc: "2026-11-26T13:00:00.000Z",
    endsAtUtc: "2026-11-27T13:00:00.000Z"
  }, draft, published, now);
  assert.equal(getEffectiveEditorial({ published, schedule }, new Date("2026-11-26T12:59:59.999Z")), published);
  assert.equal(getEffectiveEditorial({ published, schedule }, new Date("2026-11-26T13:00:00.000Z")), draft);
  assert.equal(getEffectiveEditorial({ published, schedule }, new Date("2026-11-27T13:00:00.000Z")), published);
  assert.equal(getEditorialScheduleStatus(schedule, new Date("2026-11-27T13:00:00.000Z")), "expired");
});

test("ignores malformed persisted schedule data without breaking editorial content", () => {
  assert.equal(normalizeEditorialSchedule({ startsAtUtc: "not-a-date" }), null);
});
