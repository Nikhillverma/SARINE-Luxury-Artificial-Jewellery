# SARINE customer-authentication database migration

This is a controlled, separately executed MariaDB migration. The application must never alter the customer-authentication schema during a customer request.

## Live database baseline reviewed

The Hostinger phpMyAdmin preflight for `u517551008_sarine_db` showed:

- `customers.id` is `VARCHAR(191)`.
- `customers.email` and `customers.email_normalized` are `VARCHAR(254) NOT NULL`; the migration makes them nullable so phone-only accounts can exist.
- `customers.phone` is already nullable.
- `password_hash` and `password_salt` are nullable and must remain so.
- `uq_customers_email` on `email_normalized` and `uq_customers_firebase_uid` must be preserved.
- `customer_sessions.id` is `CHAR(64)`; the existing session table and its indexes are reused unchanged.
- The inspected customer table contained one existing customer row. The row is not modified or backfilled by this migration.

## Controlled procedure

1. Take a Hostinger database backup/export.
2. Run `sql/customer-auth-preflight.sql` and retain its output. It is read-only.
3. Review `sql/customer-auth-migration.sql`. It changes only the two email column nullability definitions, adds two nullable identity columns and unique indexes, and creates three auth-specific tables. It does not update/delete customer, order, or session rows.
4. Execute `sql/customer-auth-migration.sql` manually in phpMyAdmin only after explicit approval.
5. Retain and inspect both post-migration result sets printed by that script.
6. Restart/redeploy the backend only after the migration is verified. Runtime auth checks are read-only and return a clear schema-incomplete error if the migration has not been run.

The SQL is designed to be rerunnable on supported MariaDB versions. DDL statements may commit independently; if a run stops part-way, inspect the schema and rerun only after confirming the current state.

## Application safeguards

- OTP and Google-auth routes call a read-only schema assertion; no request runs ALTER/CREATE/DROP statements.
- Schema assertion checks required nullable email columns, identity columns, auth tables, and unique identity indexes. A failed check is not cached; it can be retried after a correctly completed migration.
- The password-reset table uses `customer_id VARCHAR(191)`, matching the actual customer primary-key type.
- Existing customer sessions remain in the existing `customer_sessions` table.
- OTP email and SMS delivery remain disabled until their independent activation conditions are met.
- The application never stores plaintext OTP values; it stores a challenge-bound HMAC digest.

## Not yet performed

No production migration has been executed by this repository change. No production customer, order, or session records have been altered.
