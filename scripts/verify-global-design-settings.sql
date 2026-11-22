-- Read-only verification for the Global Design Studio settings migration.
-- Reports key names, existence and JSON validity only; never returns setting values.

SELECT
  expected.setting_key,
  CASE WHEN stored.setting_key IS NULL THEN 0 ELSE 1 END AS key_exists,
  CASE
    WHEN stored.setting_key IS NULL THEN 0
    WHEN JSON_VALID(stored.setting_value) = 1 THEN 1
    ELSE 0
  END AS valid_json
FROM (
  SELECT 'global_design_draft' AS setting_key
  UNION ALL
  SELECT 'global_design_published' AS setting_key
) AS expected
LEFT JOIN storefront_settings AS stored
  ON stored.setting_key = expected.setting_key
ORDER BY expected.setting_key;
