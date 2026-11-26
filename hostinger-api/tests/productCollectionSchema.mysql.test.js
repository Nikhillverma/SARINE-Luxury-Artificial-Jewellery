import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeTestDatabase } from "../testDatabaseSafety.js";

test("MariaDB range migration keeps legacy products unassigned and isolates both ranges", {
  skip: process.env.SARINE_RUN_PRODUCT_COLLECTION_SCHEMA_TESTS !== "true"
}, async () => {
  assertSafeTestDatabase();
  const [{ pool }, { ensureProductCollectionSchema }] = await Promise.all([
    import("../db.js"),
    import("../productCollectionSchema.js")
  ]);
  try {
    await pool.query("DROP TABLE IF EXISTS products");
    await pool.query(`CREATE TABLE products (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      status VARCHAR(24) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.execute("INSERT INTO products (id, status) VALUES (?, ?)", ["legacy-unassigned", "active"]);

    await ensureProductCollectionSchema();
    await ensureProductCollectionSchema(); // Re-running the migration must be safe.

    const [columns] = await pool.execute(
      "SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND COLUMN_NAME='product_collection'"
    );
    assert.equal(columns.length, 1);
    assert.equal(columns[0].IS_NULLABLE, "YES");

    const [indexes] = await pool.execute(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_product_collection_status'"
    );
    assert.ok(indexes.length > 0, "range/status index should exist");

    await pool.execute(
      "INSERT INTO products (id, status, product_collection) VALUES (?, ?, ?), (?, ?, ?)",
      ["artificial-1", "active", "artificial", "demi-fine-1", "active", "demi-fine"]
    );

    const [legacy] = await pool.execute("SELECT product_collection FROM products WHERE id=?", ["legacy-unassigned"]);
    assert.equal(legacy[0].product_collection, null);

    const [artificial] = await pool.execute("SELECT id FROM products WHERE product_collection=? ORDER BY id", ["artificial"]);
    const [demiFine] = await pool.execute("SELECT id FROM products WHERE product_collection=? ORDER BY id", ["demi-fine"]);
    const [home] = await pool.execute("SELECT id FROM products ORDER BY id");

    assert.deepEqual(artificial.map(row => row.id), ["artificial-1"]);
    assert.deepEqual(demiFine.map(row => row.id), ["demi-fine-1"]);
    assert.deepEqual(home.map(row => row.id), ["artificial-1", "demi-fine-1", "legacy-unassigned"]);

    const [{ validateCollectionProductIds: validateCuratedRange, mapPublicProduct: mapCuratedProduct }, { validateCollectionProductIds: validateExploreRange }, { mapPublicProduct: mapExploreProduct }] = await Promise.all([
      import("../curatedFavourites.js"),
      import("../exploreNow.js"),
      import("../publicProductMapper.js")
    ]);
    const mappedRow = { id: "artificial-1", slug: "artificial-1", name: "Artificial test item", product_collection: "artificial", images: "[]", tags: "[]", collection_slugs: "[]", price: 100, stock: 1, status: "active" };
    assert.equal(mapCuratedProduct(mappedRow).productCollection, "artificial", "Curated Favourites must preserve product range in its response");
    assert.equal(mapExploreProduct(mappedRow).productCollection, "artificial", "Explore Now must preserve product range in its response");
    for (const validateSelection of [validateCuratedRange, validateExploreRange]) {
      assert.equal(await validateSelection(["artificial-1"], "artificial"), null);
      assert.equal(await validateSelection(["demi-fine-1"], "demi-fine"), null);
      assert.match(await validateSelection(["demi-fine-1"], "artificial"), /chosen homepage range/);
      assert.match(await validateSelection(["artificial-1", "demi-fine-1"], "artificial"), /chosen homepage range/);
      assert.equal(await validateSelection(["legacy-unassigned"], null), null, "Home keeps the original mixed catalogue");
      assert.equal(await validateSelection([], "artificial"), null, "empty range curation remains valid");
    }
  } finally {
    await pool.query("DROP TABLE IF EXISTS products").catch(() => {});
    await pool.end();
  }
});
