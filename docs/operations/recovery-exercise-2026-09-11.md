# CompassU Recovery Exercise — 2026-09-11

**Item:** Launch Readiness #6 — Monitoring, Incident Response & Recovery Testing  
**Environment:** Isolated Supabase development branches  
**Production impact:** None  
**Current result:** PARTIAL PASS — clean migration replay and table reconstruction now succeed; database-function drift remains

## Objective

Verify that CompassU production can be reconstructed in an isolated Supabase environment without modifying or risking production data.

## Initial failure

The first isolated recovery branch reached an `ACTIVE_HEALTHY` provider state but entered `MIGRATIONS_FAILED`. The replay stopped before the privacy-safe deletion migration because a diagnostic privilege migration was not safe when optional diagnostic functions were absent. Production also contained tenant, institution-membership, reporting and invitation tables not represented in the replayable migration chain.

## Remediation completed

The diagnostic privilege migration was made replay-safe. The privacy-safe deletion migration was made tolerant of clean environments. A recovery schema baseline was added for production-only tenant/admin/reporting tables, constraints, indexes, RLS and grants. The baseline was corrected to create the authorization helper functions required by its RLS policies before policy creation.

A fresh isolated branch named `recovery-test-item6-final` then completed the full migration chain and reached `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`.

The reconstructed branch now contains the same 29 public tables as production, including:

- `account_institutions`
- `admin_role_invitations`
- `institution_memberships`
- `institution_report_delivery_log`
- `institution_reporting_profiles`
- `organization_memberships`
- `organizations`
- `tenant_institutions`

All reconstructed public tables have RLS enabled. A transactional create/rollback smoke test on `organizations` succeeded. Privacy-related FK behavior was verified in the reconstructed branch: user-owned membership relationships use `ON DELETE CASCADE`, while creator/audit references that must preserve historical records use `ON DELETE SET NULL`.

The recovery helper functions introduced by the baseline were initially executable by `anon` due to PostgreSQL default function privileges. This was corrected in production with a follow-up migration that revokes execution from `public`/`anon` and grants intended execution only to `authenticated`/`service_role`. The recovery branch was rebased and the anonymous SECURITY DEFINER advisor warnings were eliminated.

## Remaining schema drift

A broader production-versus-recovery function inventory found that production currently contains **41 public database functions**, while the clean recovery branch contains **9**. This means a substantial set of production functions was created outside the replayable migration history and remains a disaster-recovery gap even though table reconstruction now succeeds.

Missing functions include administrator 50K paging/dashboard RPCs, tenant-role invitation and membership RPCs, institutional analytics/trend/comparison functions, monthly reporting service functions and Stage 3 diagnostic functions.

This is not an active production outage. Production remains healthy. It is a recoverability/configuration-drift issue that must be reconciled before Item #6 is fully closed.

## Security verification

The fresh recovery environment now shows the same five informational `RLS Enabled No Policy` findings expected for server-managed administrative tables. No anonymous SECURITY DEFINER execution warning remains after the follow-up privilege migration. Production likewise has no anonymous SECURITY DEFINER warning. The authenticated SECURITY DEFINER findings remain the previously reviewed, intentional RPC surface and require continued caller authorization controls.

Supabase remediation references:

- RLS informational finding: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- SECURITY DEFINER execution finding: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Remaining remediation before Item #6 can close

1. Baseline all production-only public functions and their execution grants into replayable/source-controlled migrations.
2. Rebuild a fresh isolated branch again and verify function parity with production.
3. Compare remaining schema objects such as triggers/views and critical indexes/grants.
4. Run application smoke tests against the reconstructed environment for authentication, assessment save/finalize, results, email, administrator workflows, institution reporting and deletion/de-identification.
5. Record measured recovery time and finalize RTO/RPO recommendations.

## Cost control

Temporary Supabase recovery branches are deleted after evidence collection so hourly branch charges do not continue unnecessarily.

## Tracking

GitHub Issue #5 tracks the remaining recovery-parity work.