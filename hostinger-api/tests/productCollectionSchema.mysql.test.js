import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { assertSafeTestDatabase } from "../testDatabaseSafety.js";

test("MariaDB range migration keeps legacy products unassigned and isolates both ranges", {
  skip: process.env.SARINE_RUN_PRODUCT_COLLECTION_SCHEMA_TESTS !== "true"
}, async () => {
  assertSafeTestDatabase();
  const mysql = (await import("mysql2/promise")).default;
  const isolatedDatabase = "sarine_product_collection_range_test";
  const adminConnection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
  await adminConnection.query(`CREATE DATABASE IF NOT EXISTS `${isolatedDatabase}` CHARACTER SET utf8mb4`);
  process.env.DB_NAME = isolatedDatabase;
  assertSafeTestDatabase();
  let pool;
  let server;
  try {
    const modules = await Promise.all([import("../db.js"), import("../productCollectionSchema.js")]);
    pool = modules[0].pool;
    const { ensureProductCollectionSchema } = modules[1];
    await pool.query("DROP TABLE IF EXISTS storefront_settings");
    await pool.query("DROP TABLE IF EXISTS products");
    await pool.query(`CREATE TABLE products (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      status VARCHAR(24) NOT NULL,
      slug VARCHAR(180) NULL,
      name VARCHAR(255) NULL,
      description TEXT NULL,
      short_description TEXT NULL,
      price DECIMAL(10,2) NULL,
      compare_at_price DECIMAL(10,2) NULL,
      images LONGTEXT NULL,
      tags LONGTEXT NULL,
      collection_slugs LONGTEXT NULL,
      category_id VARCHAR(64) NULL,
      jewellery_type VARCHAR(80) NULL,
      stock INT NULL,
      created_at TIMESTAMP(3) NULL
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
      `INSERT INTO products (id, status, product_collection, slug, name, price, images, tags, collection_slugs, stock) VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["artificial-1", "active", "artificial", "artificial-1", "Artificial test item", 100, "[]", "[]", "[]", 5,
       "demi-fine-1", "active", "demi-fine", "demi-fine-1", "Demi-Fine test item", 200, "[]", "[]", "[]", 5]
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

    await pool.query(`CREATE TABLE storefront_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const mixedIds = ["artificial-1", "demi-fine-1"];
    for (const collection of ["artificial", "demi-fine"]) {
      await pool.execute(
        "INSERT INTO storefront_settings (setting_key, setting_value) VALUES (?, ?), (?, ?)",
        [
          "curated_favourites_published_" + collection,
          JSON.stringify({ version: 1, productIds: mixedIds, configured: true }),
          "explore_now_published_" + collection,
          JSON.stringify({ version: 1, productIds: mixedIds, displayCount: 4, configured: true })
        ]
      );
    }

    const [{ publicCuratedFavouritesRouter }, { publicExploreNowRouter }] = await Promise.all([
      import("../curatedFavourites.js"),
      import("../exploreNow.js")
    ]);
    const app = express();
    app.use("/curated", publicCuratedFavouritesRouter);
    app.use("/explore", publicExploreNowRouter);
    server = app.listen(0);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = "http://127.0.0.1:" + address.port;
    for (const collection of ["artificial", "demi-fine"]) {
      const expectedId = collection === "artificial" ? "artificial-1" : "demi-fine-1";
      const curatedResponse = await fetch(baseUrl + "/curated?productCollection=" + collection);
      assert.equal(curatedResponse.status, 200);
      const curated = await curatedResponse.json();
      assert.deepEqual(curated.products.map(product => product.id), [expectedId]);
      assert.equal(curated.products[0].productCollection, collection);

      const exploreResponse = await fetch(baseUrl + "/explore?productCollection=" + collection);
      assert.equal(exploreResponse.status, 200);
      const explore = await exploreResponse.json();
      assert.deepEqual(explore.products.map(product => product.id), [expectedId]);
      assert.equal(explore.products[0].productCollection, collection);
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) {
      await pool.query("DROP TABLE IF EXISTS storefront_settings").catch(() => {});
      await pool.query("DROP TABLE IF EXISTS products").catch(() => {});
      await pool.end();
    }
    await adminConnection.query(`DROP DATABASE IF EXISTS `${isolatedDatabase}``).catch(() => {});
    await adminConnection.end();
  }
});
