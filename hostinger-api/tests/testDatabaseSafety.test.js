import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeTestDatabase } from "../testDatabaseSafety.js";

const safeEnvironment = {
  DB_HOST: "127.0.0.1",
  DB_NAME: "sarine_test",
  SARINE_ALLOW_DESTRUCTIVE_TEST_DB: "true"
};

test("allows explicitly opted-in loopback test database", () => {
  assert.equal(assertSafeTestDatabase(safeEnvironment), true);
});

test("refuses destructive tests without explicit opt-in", () => {
  assert.throws(
    () => assertSafeTestDatabase({ ...safeEnvironment, SARINE_ALLOW_DESTRUCTIVE_TEST_DB: "false" }),
    /explicitly opted-in/
  );
});

test("refuses non-loopback database hosts", () => {
  assert.throws(
    () => assertSafeTestDatabase({ ...safeEnvironment, DB_HOST: "db.hostinger.com" }),
    /DB_HOST must be localhost/
  );
});

test("refuses database names without a test suffix", () => {
  assert.throws(
    () => assertSafeTestDatabase({ ...safeEnvironment, DB_NAME: "sarine_db" }),
    /DB_NAME must end in _test or -test/
  );
});

test("refuses missing database configuration", () => {
  assert.throws(() => assertSafeTestDatabase({}), /explicitly opted-in/);
});
