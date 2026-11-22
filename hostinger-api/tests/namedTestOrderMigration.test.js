import test from "node:test";
import assert from "node:assert/strict";
import { markNamedTestProductOrdersAsTests } from "../prelaunchOrderMigration.js";

function fakeConnection({ alreadyApplied = false } = {}) {
  const calls = [];
  return {
    calls,
    async execute(sql, params = []) {
      calls.push({ method: "execute", sql, params });
      if (sql.startsWith("SELECT migration_key")) {
        return [alreadyApplied ? [{ migration_key: "applied" }] : []];
      }
      return [{ affectedRows: 1 }];
    },
    async beginTransaction() { calls.push({ method: "beginTransaction" }); },
    async commit() { calls.push({ method: "commit" }); },
    async rollback() { calls.push({ method: "rollback" }); }
  };
}

test("marks only orders exclusively containing the named internal test product", async () => {
  const connection = fakeConnection();
  await markNamedTestProductOrdersAsTests(connection);
  const update = connection.calls.find(call => call.sql?.startsWith("UPDATE orders AS o"));
  assert.ok(update);
  assert.match(update.sql, /EXISTS\s*\([\s\S]*test_item\.product_name = \?/);
  assert.match(update.sql, /NOT EXISTS\s*\([\s\S]*other_item\.product_name/);
  assert.deepEqual(update.params, ["SARINE Migration Test", "SARINE Migration Test"]);
  assert.equal(connection.calls.at(-1).method, "commit");
});

test("does not change orders again after the one-time migration is recorded", async () => {
  const connection = fakeConnection({ alreadyApplied: true });
  await markNamedTestProductOrdersAsTests(connection);
  assert.equal(connection.calls.some(call => call.sql?.startsWith("UPDATE orders")), false);
  assert.equal(connection.calls.some(call => call.method === "beginTransaction"), false);
});

test("rolls back the classification if the migration fails", async () => {
  const connection = fakeConnection();
  connection.execute = async (sql, params = []) => {
    connection.calls.push({ method: "execute", sql, params });
    if (sql.startsWith("SELECT migration_key")) return [[]];
    if (sql.startsWith("UPDATE orders")) throw new Error("simulated database failure");
    return [[]];
  };
  await assert.rejects(markNamedTestProductOrdersAsTests(connection), /simulated database failure/);
  assert.equal(connection.calls.some(call => call.method === "rollback"), true);
});
