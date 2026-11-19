-- SARINE customer-authentication schema preflight
-- READ ONLY: run this in Hostinger phpMyAdmin against u517551008_sarine_db.
-- Do not run migrations or ALTER/CREATE statements from this diagnostic.

SELECT
  TABLE_NAME,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  CHARACTER_SET_NAME,
  COLLATION_NAME,
  EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'u517551008_sarine_db'
  AND TABLE_NAME IN ('customers', 'customer_sessions', 'orders')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT
  TABLE_NAME,
  INDEX_NAME,
  NON_UNIQUE,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS indexed_columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'u517551008_sarine_db'
  AND TABLE_NAME IN ('customers', 'customer_sessions')
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;

-- These counts help detect conflicts before unique indexes are created.
SELECT
  COUNT(*) AS customers_total,
  SUM(email IS NULL OR email = '') AS customers_without_email,
  SUM(email_normalized IS NULL OR email_normalized = '') AS customers_without_normalized_email,
  SUM(phone IS NULL OR phone = '') AS customers_without_phone
FROM `u517551008_sarine_db`.customers;

-- phone_normalized and google_sub do not exist in the inspected live schema.
-- Do not query them before migration. The migration adds both as NULL columns,
-- so there are no pre-existing normalized values to collide with unique indexes.
-- If running this preflight on another environment where either column already
-- exists, inspect duplicates before applying the unique indexes.

-- Confirm customer IDs referenced by existing sessions have matching customers.
SELECT COUNT(*) AS orphan_customer_sessions
FROM `u517551008_sarine_db`.customer_sessions s
LEFT JOIN `u517551008_sarine_db`.customers c ON c.id = s.customer_id
WHERE c.id IS NULL;
