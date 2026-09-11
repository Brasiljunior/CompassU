# CompassU Recovery Exercise — 2026-09-11

**Item:** Launch Readiness #6 — Monitoring, Incident Response & Recovery Testing  
**Environment:** Isolated Supabase development branch  
**Production impact:** None  
**Result:** FAILED — migration replay/configuration drift identified

## Objective

Verify that CompassU production can be reconstructed in an isolated Supabase environment without modifying or risking production data.

## Test setup

A temporary Supabase development branch named `recovery-test-item6` was created from the production CompassU project after explicit approval of the temporary branch charge. The branch was created without production data.

## Observed result

The preview project itself reached an `ACTIVE_HEALTHY` provider state, but the branch migration status became `MIGRATIONS_FAILED`.

Production migration history includes:

- `20260911191531 restrict_stage3a_diagnostic_rpcs`
- `20260911224447 privacy_safe_auth_user_deletion`

The recovery branch successfully replayed migrations only through:

- `20260911191505 restrict_server_only_admin_tables`

The two later migrations were not applied.

## Root-cause evidence

The recorded `restrict_stage3a_diagnostic_rpcs` migration contains direct `REVOKE EXECUTE` statements against two diagnostic functions. Those functions are not present in the clean recovery schema, so this migration is not safe to replay in that environment.

A production-versus-recovery table comparison also identified production tables absent from the reconstructed branch:

- `account_institutions`
- `admin_role_invitations`
- `institution_memberships`
- `institution_report_delivery_log`
- `institution_reporting_profiles`
- `organization_memberships`
- `organizations`
- `tenant_institutions`

Review of recorded migration statements did not find creation of the membership/admin-role schema objects in the replayable migration history. This indicates production schema drift from the migration chain.

## Impact assessment

This finding does **not** indicate an active production outage or data-loss event. Production remains operational. It does mean that a clean migration-based reconstruction cannot currently be treated as a verified disaster-recovery path.

Therefore Item #6 cannot be marked complete until the schema/migration drift is reconciled and the clean reconstruction test passes.

## Required remediation

1. Inventory production-only schema objects, functions, policies, indexes and grants that are missing from replayable migrations.
2. Reconcile those objects into idempotent, source-controlled migration logic.
3. Make optional diagnostic privilege changes safe when their target functions are absent.
4. Ensure the privacy-safe deletion migration runs only after all referenced tables/constraints exist.
5. Create a fresh isolated Supabase recovery branch and verify all production migrations complete successfully.
6. Compare reconstructed schema against production.
7. Run functional recovery smoke tests for authentication, assessment save/finalize, results, email path, administrator/MFA workflows, institution scoping/reporting, and deletion/de-identification controls.

## Cost control

The temporary recovery branch should be deleted after evidence collection so the hourly test charge does not continue unnecessarily.

## Tracking

GitHub Issue #5 tracks remediation of this recovery blocker.