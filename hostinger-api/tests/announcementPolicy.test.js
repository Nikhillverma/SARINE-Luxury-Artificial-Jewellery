import test from "node:test";
import assert from "node:assert/strict";
import { buildAnnouncementSettings, normalizeAnnouncementSettings } from "../announcementPolicy.js";

test("normalizes legacy announcement settings without losing compatibility", () => {
  assert.deepEqual(normalizeAnnouncementSettings('{"message":"Sale","active":true}'), {
    message: "Sale", active: true, trustMessages: []
  });
});

test("persists admin-managed trust messages with the announcement", () => {
  assert.deepEqual(buildAnnouncementSettings({
    message: " Festive edit ",
    active: true,
    trustMessages: [" Free shipping ", "Easy returns", "Gift packaging"]
  }, null), {
    message: "Festive edit",
    active: true,
    trustMessages: ["Free shipping", "Easy returns", "Gift packaging"]
  });
});

test("preserves existing trust messages when older clients omit the field", () => {
  assert.deepEqual(buildAnnouncementSettings({ message: "Updated", active: false }, {
    message: "Old", active: true, trustMessages: ["Shipping", "Returns"]
  }), {
    message: "Updated", active: false, trustMessages: ["Shipping", "Returns"]
  });
});

test("allows the admin to clear all trust messages", () => {
  assert.deepEqual(buildAnnouncementSettings({ message: "", active: false, trustMessages: [] }, {
    message: "", active: false, trustMessages: ["Old"]
  }).trustMessages, []);
});

test("rejects more than three or overlong trust messages", () => {
  assert.throws(() => buildAnnouncementSettings({ trustMessages: ["1", "2", "3", "4"] }, null), /up to three/i);
  assert.throws(() => buildAnnouncementSettings({ trustMessages: ["x".repeat(101)] }, null), /100 characters/i);
});
