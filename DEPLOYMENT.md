# Global Design Studio deployment

Deploy this feature in the order below. Do not deploy the frontend before the API is live and verified.

## 1. Back up the database

1. Open Hostinger hPanel → Databases → phpMyAdmin.
2. Select the SARINE database and export the complete `storefront_settings` table as SQL, including both structure and data.
3. Keep the export safely outside the server. Do not proceed without a verified backup.

## 2. Deploy the backend API

Deploy the backend build containing the Global Design Studio API changes to the existing Hostinger backend application. Keep the current database, environment variables, domain and application configuration unchanged. Do not create a replacement app.

The API deploy performs a non-destructive migration from the legacy `global_design` wrapper into `global_design_draft` and `global_design_published`. Existing new-format keys are preserved. The legacy wrapper is retained and dual-written for rollback compatibility.

## 3. Verify all four API routes

Use the same authenticated admin session/cookie mechanism used by the existing admin API. Do not paste credentials or session cookies into tickets or logs.

| Method | Route | Expected response |
|---|---|---|
| GET | `/api/admin/storefront/design` | `{ draft, published }` |
| PUT | `/api/admin/storefront/design` | `{ success: true, draft }` |
| POST | `/api/admin/storefront/design/publish` | `{ success: true, published }` |
| GET | `/api/storefront/design` | `{ design }` (published settings only) |

First verify both GET routes and run `scripts/verify-global-design-settings.sql` in phpMyAdmin. The SQL is read-only and reports only the expected key names, existence and JSON validity.

PUT and POST are write operations. Before testing them, confirm the draft contains the exact values you intend to save/publish. Verify PUT with the current intended draft, then verify POST only when publishing that same draft is acceptable. Confirm the public GET returns the published design and never exposes the draft.

## 4. Deploy the frontend

Only after the API routes and SQL verification pass, deploy the frontend containing the updated Global Design Studio editor. Confirm the editor loads the saved draft, edits can be saved, and the publish action reports success. Do not merge this pull request as part of deployment.

## Rollback

1. Stop the rollout; do not deploy the frontend if API verification fails.
2. Redeploy the previously working backend build/ZIP to the same Hostinger backend application, keeping its existing environment variables and database connection.
3. Leave the database untouched during the code rollback. The legacy `global_design` row remains available and is dual-written by the new API for compatibility.
4. If a database record was actually changed or corrupted and must be restored, use the SQL backup from step 1 to restore the affected `storefront_settings` data. Do not restore the whole table unless necessary, because that could overwrite unrelated settings changed after the backup.
5. If the frontend was already deployed, redeploy the previous frontend build as well. Re-test the admin and public design GET routes after rollback.

No merge or deployment is performed by this change.
