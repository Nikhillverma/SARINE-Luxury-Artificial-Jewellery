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

-- If phone_normalized already exists, this reports duplicate non-empty values.
-- If it does not exist, run the columns query above first; this query will then
-- need to be skipped until that column has been added.
SELECT phone_normalized, COUNT(*) AS duplicate_count
FROM `u517551008_sarine_db`.customers
WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
GROUP BY phone_normalized
HAVING COUNT(*) > 1;

-- Detect duplicate Google subject links before adding a unique index.
-- If google_sub does not exist yet, skip this query until the column is added.
SELECT google_sub, COUNT(*) AS duplicate_count
FROM `u517551008_sarine_db`.customers
WHERE google_sub IS NOT NULL AND google_sub <> ''
GROUP BY google_sub
HAVING COUNT(*) > 1;

-- Confirm customer IDs referenced by existing sessions have matching customers.
SELECT COUNT(*) AS orphan_customer_sessions
FROM `u517551008_sarine_db`.customer_sessions s
LEFT JOIN `u517551008_sarine_db`.customers c ON c.id = s.customer_id
WHERE c.id IS NULL;
