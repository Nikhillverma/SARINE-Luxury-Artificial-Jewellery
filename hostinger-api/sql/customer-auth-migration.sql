-- SARINE customer authentication migration
-- TARGET: u517551008_sarine_db (MariaDB / Hostinger)
-- SAFETY: This file is an explicit, one-time schema migration.
-- It does not insert, update, delete, or rewrite customer/order/session rows.
-- Review the read-only customer-auth-preflight.sql first.
-- Do NOT execute against production until the migration is explicitly approved.
-- The statements are idempotent on supported MariaDB versions.

USE `u517551008_sarine_db`;

-- Permit phone-only customer accounts while retaining the existing unique
-- uq_customers_email index on email_normalized. Existing email values remain.
ALTER TABLE customers
  MODIFY COLUMN email VARCHAR(254)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  MODIFY COLUMN email_normalized VARCHAR(254)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;

-- Normalized Indian phone number is stored as 10 digits; Google subject is
-- the stable OpenID Connect subject returned by Google's verified ID token.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(20) NULL AFTER phone,
  ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) NULL AFTER phone_normalized;

-- NULL values remain allowed and do not collide under MariaDB unique indexes.
-- Existing customer records are not populated or reassigned by this migration.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_phone_normalized
  ON customers (phone_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_google_sub
  ON customers (google_sub);

CREATE TABLE IF NOT EXISTS customer_auth_challenges (
  id CHAR(36) NOT NULL,
  identifier VARCHAR(254) NOT NULL,
  customer_id VARCHAR(191) NULL,
  method VARCHAR(10) NOT NULL,
  purpose VARCHAR(24) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_customer_auth_challenge_lookup (identifier, purpose, created_at),
  INDEX idx_customer_auth_challenge_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_auth_delivery_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  challenge_id CHAR(36) NULL,
  method VARCHAR(10) NOT NULL,
  purpose VARCHAR(24) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  identifier_masked VARCHAR(254) NOT NULL,
  status VARCHAR(12) NOT NULL,
  failure_code VARCHAR(40) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_customer_auth_delivery_recent (created_at, status),
  INDEX idx_customer_auth_delivery_method (method, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Match the existing customers.id type (VARCHAR(191)); do not use CHAR(36).
CREATE TABLE IF NOT EXISTS customer_password_resets (
  token_hash CHAR(64) NOT NULL,
  customer_id VARCHAR(191) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_hash),
  INDEX idx_customer_password_reset_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Post-migration verification (read-only).
SELECT
  TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'customers' AND COLUMN_NAME IN
      ('id', 'email', 'email_normalized', 'phone', 'phone_normalized', 'google_sub'))
    OR TABLE_NAME IN
      ('customer_auth_challenges', 'customer_auth_delivery_events', 'customer_password_resets')
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS indexed_columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('customers', 'customer_auth_challenges',
                     'customer_auth_delivery_events', 'customer_password_resets')
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;
