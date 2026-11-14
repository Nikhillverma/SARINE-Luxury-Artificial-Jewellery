import { Router } from "express";
import { pool } from "./db.js";
import { requireAdminAuth } from "./adminAuth.js";

const router = Router();
router.use(requireAdminAuth);

// Read-only production schema inspection. Never returns row contents or credentials.
router.get("/", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    const [tableRows] = await pool.execute(
      `SELECT TABLE_NAME AS tableName, ENGINE AS engine,
              TABLE_ROWS AS approximateRows, TABLE_COLLATION AS collationName
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`
    );
    const [columnRows] = await pool.execute(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName,
              ORDINAL_POSITION AS ordinalPosition, COLUMN_TYPE AS columnType,
              IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault,
              COLUMN_KEY AS columnKey, EXTRA AS extra
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME, ORDINAL_POSITION`
    );
    const [indexRows] = await pool.execute(
      `SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName,
              NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS sequence,
              COLUMN_NAME AS columnName, INDEX_TYPE AS indexType
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
    );
    const [foreignKeyRows] = await pool.execute(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName,
              CONSTRAINT_NAME AS constraintName,
              REFERENCED_TABLE_NAME AS referencedTable,
              REFERENCED_COLUMN_NAME AS referencedColumn
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`
    );

    const tables = tableRows.map((table) => ({
      ...table,
      approximateRows: table.approximateRows === null ? null : Number(table.approximateRows),
      columns: columnRows.filter((column) => column.tableName === table.tableName),
      indexes: indexRows.filter((index) => index.tableName === table.tableName),
      foreignKeys: foreignKeyRows.filter((key) => key.tableName === table.tableName)
    }));

    const findings = [];
    for (const table of tables) {
      if (table.engine !== "InnoDB") findings.push({
        severity: "warning", table: table.tableName,
        issue: "Table is not InnoDB; transactional guarantees may be unavailable."
      });
      if (!table.indexes.some((index) => index.indexName === "PRIMARY")) findings.push({
        severity: "warning", table: table.tableName,
        issue: "Table has no primary key."
      });
    }

    return res.json({
      database: "connected",
      schema: "current",
      readOnly: true,
      inspectedAt: new Date().toISOString(),
      tableCount: tables.length,
      tables,
      findings
    });
  } catch (error) {
    next(error);
  }
});

export default router;
