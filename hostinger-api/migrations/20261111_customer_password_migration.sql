-- SARINE customer password migration
-- Run once against u517551008_sarine_db after reviewing this migration.
-- This changes schema only; it does not import, reset, or modify customer accounts.
-- MariaDB supports ADD COLUMN IF NOT EXISTS.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS password_salt VARCHAR(255) NULL AFTER password_hash,
  ADD COLUMN IF NOT EXISTS password_scheme VARCHAR(32) NOT NULL DEFAULT 'bcrypt' AFTER password_salt;
