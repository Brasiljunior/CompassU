# CompassU Supabase Recovery Parity Manifest

Validated: 2026-09-11

This manifest records the production migrations introduced during Launch Readiness Item #6 to eliminate clean-recovery drift. Supabase's migration history is the executable replay source for preview branches; related application SQL is also maintained under `supabase/` in this repository.

## Recovery migrations

- `20260911231546_recovery_schema_baseline_for_tenant_admin_reporting_fixed` — tenant, institution membership, reporting, invitation and account-institution schema; authorization helpers; RLS; indexes and grants.
- `20260911231753_secure_recovery_helper_function_execution` — removes anonymous/public execution from recovery helper SECURITY DEFINER functions.
- `20260911233621_baseline_admin_50k_recovery_functions` — 50K administrator paging, export, dashboard, identity, email existence and institution-list RPCs.
- `20260911233712_baseline_tenant_admin_recovery_functions_part1` — tenant-role authorization, context/listing and diagnostic functions.
- `20260911233732_baseline_tenant_admin_recovery_functions_part2` — administrator invitation acceptance/revocation/creation and scoped membership management.
- `20260911233754_baseline_reporting_recovery_functions` — monthly reporting profile, delivery log and service-role functions.
- `20260911233831_baseline_institutional_analytics_recovery_functions` — institutional analytics, reporting-period analytics, comparison and trends RPCs.
- `20260911234017_baseline_recovery_index_parity` — eight indexes missing from prior clean reconstructions, including 50K trigram/search indexes.
- `20260911234147_normalize_pg_trgm_extension_schema` — ensures `pg_trgm` lives in the `extensions` schema in clean environments.
- `20260911234320_baseline_recovery_service_role_function_grants` — restores four service-role function grants required for exact production parity.

## Final validation evidence

A fresh isolated branch (`recovery-test-item6-final-verified`) replayed the complete migration history and reached `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY` with:

- 29 public tables
- 41 public application functions
- 82 public indexes
- 0 public views
- 1 non-internal public trigger
- `pg_trgm` in `extensions`
- function EXECUTE counts matching production exactly: anon 1, authenticated 30, service_role 41
- nine Supabase Edge Functions active with JWT verification enabled

The final security advisor matched the reviewed production baseline and contained no anonymous SECURITY DEFINER execution warning.

## Related source files

The repository's `supabase/` directory contains the maintained SQL sources for the administrator 50K layer, institutional analytics/reporting stages, monthly-reporting controls, invitation history, and related backend functions. This manifest is intended to keep the recovery migration sequence and validation result explicit alongside those source files.

See `docs/operations/recovery-exercise-2026-09-11.md` for the recovery-test narrative and limitations. The reconstruction test verifies schema/backend deployment recovery; a separate controlled production-data backup restore test remains required for Item #6.