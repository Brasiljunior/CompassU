# CompassU Recovery Exercise — 2026-09-11

**Item:** Launch Readiness #6 — Monitoring, Incident Response & Recovery Testing  
**Environment:** Isolated Supabase development branches  
**Production impact:** None  
**Final database reconstruction result:** PASS

## Objective

Verify that the CompassU production database/application backend can be reconstructed in an isolated Supabase environment without modifying or risking production data.

## Initial failure and remediation

The first recovery branch exposed migration/configuration drift. Historical diagnostic privilege logic was not safe in a clean environment, production contained tenant/admin/reporting tables not represented in the replayable migration chain, and a later comparison showed production-only RPC/function and index drift.

The remediation work made the historical migrations replay-safe and added explicit recovery baselines for tenant/admin/reporting schema, privacy-safe deletion constraints, administrator 50K RPCs, tenant-role invitation/membership RPCs, institutional analytics/reporting RPCs, service-role functions, indexes, and execution grants. The `pg_trgm` extension was also normalized to the `extensions` schema so extension-owned functions do not pollute the public application schema during a clean rebuild.

## Final clean reconstruction

A final fresh recovery branch named `recovery-test-item6-final-verified` completed the migration chain and reached `FUNCTIONS_DEPLOYED` with provider status `ACTIVE_HEALTHY`.

The clean reconstructed environment matched production on the critical public-schema inventory:

- **29 public tables**
- **41 public application functions**
- **82 public indexes**
- **0 public views**
- **1 non-internal public trigger**
- `pg_trgm` installed in the **extensions** schema

Function execution grants also matched production exactly:

- `anon`: **1** executable public function
- `authenticated`: **30** executable public functions
- `service_role`: **41** executable public functions

The recovery project also received the same nine active Edge Functions used by the CompassU backend, including `send-results-email`, the administrator console functions, batch invitation/email-status functions, password-change confirmation, and the `admin-console-50k` function. All recovered Edge Functions were active and configured to verify JWTs.

## Privacy and security verification

Privacy FK behavior remained correct in the reconstructed environment: user-owned membership relationships use `ON DELETE CASCADE`, while historical creator/audit references that must remain for audit history use `ON DELETE SET NULL`.

The final recovery security-advisor result matched the reviewed production baseline: five informational `RLS Enabled No Policy` findings on server-managed administrative tables and the previously reviewed authenticated SECURITY DEFINER RPC surface. No anonymous SECURITY DEFINER execution warning remained.

Supabase remediation references:

- RLS informational finding: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- SECURITY DEFINER execution finding: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## What this test proves

This exercise proves that CompassU's current **schema, database functions, indexes, grants, and deployed Supabase Edge Function surface can be reconstructed from the production migration/deployment state in a clean isolated Supabase branch**.

This exercise does **not** by itself prove recovery of production student data from a database backup. A separate controlled backup/data-restore validation remains part of Item #6 and must be performed without overwriting production.

## RTO/RPO interpretation

The clean preview environment and migration replay completed quickly during the exercise, but that observed branch-build duration is not a production data-restore RTO. The existing internal planning targets remain provisional at **RTO 4 hours** and **RPO 24 hours** until an actual backup/data-restore exercise is completed and timed.

## Cost control

Temporary recovery branches are deleted after evidence collection so hourly branch charges do not continue unnecessarily.

## Outcome

**Database reconstruction parity: PASS.** The schema/function drift defect tracked in GitHub Issue #5 is resolved. Item #6 remains open only for the remaining operational monitoring/alerting validation and controlled backup/data-restore exercise.