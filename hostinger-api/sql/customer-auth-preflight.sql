-- SARINE customer-authentication schema preflight
-- READ ONLY: run this in Hostinger phpMyAdmin with u517551008_sarine_db selected.
-- Uses database-local SHOW statements; no information_schema access is required.
-- Do not run migrations or ALTER/CREATE statements from this diagnostic.

SHOW COLUMNS FROM customers;
SHOW COLUMNS FROM customer_sessions;
SHOW COLUMNS FROM orders;

SHOW INDEX FROM customers;
SHOW INDEX FROM customer_sessions;

-- These counts help detect existing empty contact fields before migration.
SELECT
  COUNT(*) AS customers_total,
  SUM(email IS NULL OR email = '') AS customers_without_email,
  SUM(email_normalized IS NULL OR email_normalized = '') AS customers_without_normalized_email,
  SUM(phone IS NULL OR phone = '') AS customers_without_phone
FROM customers;

-- Confirm customer IDs referenced by existing sessions have matching customers.
SELECT COUNT(*) AS orphan_customer_sessions
FROM customer_sessions s
LEFT JOIN customers c ON c.id = s.customer_id
WHERE c.id IS NULL;
