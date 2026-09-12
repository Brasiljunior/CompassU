# CompassU Recovery Exercise — 2026-09-11

**Item:** Launch Readiness #6 — Monitoring, Incident Response & Recovery Testing  
**Environment:** Isolated Supabase recovery branches plus Restore-to-New-Project backup exercise  
**Production impact:** None  
**Final database reconstruction result:** PASS  
**Final production-data backup restore result:** PASS

## Objective

Verify that CompassU can recover both its application/database structure and actual production database contents in an isolated Supabase environment without modifying or risking production.

## Clean reconstruction test

The first recovery branch exposed migration/configuration drift. Historical diagnostic privilege logic was not safe in a clean environment, production contained tenant/admin/reporting objects not fully represented in replayable migration history, and later comparison showed production-only function/index drift.

The remediation work made the migration chain replay-safe and added explicit recovery baselines for tenant/admin/reporting schema, privacy-safe deletion constraints, administrator 50K RPCs, tenant-role invitation/membership RPCs, institutional analytics/reporting RPCs, service-role functions, indexes, grants, and `pg_trgm` placement.

A fresh clean recovery branch subsequently reached `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY` and matched production on the critical public-schema inventory:

- **29 public tables**
- **41 public application functions**
- **82 public indexes**
- **0 public views**
- **1 non-internal public trigger**
- `pg_trgm` in the `extensions` schema
- Function execution grants: `anon` **1**, `authenticated` **30**, `service_role` **41**

The clean reconstruction environment also received the same nine active Supabase Edge Functions, all with JWT verification enabled.

## Production-data backup restore test

On 2026-09-12, the most recent completed Supabase daily backup visible in the production dashboard (2026-09-11 08:46:34 UTC) was restored using Supabase **Restore to new project**. The restore created `CompassU-Recovery-Test-2026-09-11` in the same `us-east-1` region. Supabase displayed **$0 additional monthly compute**, **$0 additional monthly disk**, and **$0 total** for the exercise.

The restored project reached `ACTIVE_HEALTHY` and preserved the expected historical recovery point. Core data comparisons were:

| Metric | Production at validation | Restored backup | Result |
|---|---:|---:|---|
| Public tables | 29 | 29 | PASS |
| Public functions | 41 | 41 | PASS |
| Public indexes | 82 | 82 | PASS |
| Assessment attempts | 22 | 22 | PASS |
| Assessment responses | 1,760 | 1,760 | PASS |
| Major matches | 220 | 220 | PASS |
| Completed attempts | 22 | 22 | PASS |
| Distinct assessment users | 19 | 19 | PASS |
| Admin users | 2 | 2 | PASS |
| Organizations | 5 | 5 | PASS |
| Tenant institutions | 5 | 5 | PASS |
| Institution memberships | 1 | 1 | PASS |
| Reporting profiles | 1 | 1 | PASS |
| Report delivery log | 1 | 1 | PASS |

Expected point-in-time differences were also observed: production had 135 Auth users versus 132 in the restored backup, 134 account-institution assignments versus 133, and 111 audit rows versus 110. These differences are consistent with activity that occurred after the backup snapshot and confirm that the restore represented the historical recovery point rather than a live copy of current production.

Assessment integrity matched exactly through the latest assessment activity represented in the backup: 22 completed attempts across 19 students, with identical earliest/latest assessment timestamps between production and restored data for the assessment records present.

## Post-restore migration/security replay

Because the selected backup predates later Item #2/#5 hardening migrations, the restored project initially reflected the historical security state from the backup. This is an important disaster-recovery finding: a database restore must be followed by replay of all migrations created after the backup timestamp.

The recovery test replayed the critical post-backup controls in the isolated restored project:

- revoked anonymous/public execution of SECURITY DEFINER functions;
- restricted server-only administrator tables;
- restricted Stage 3 diagnostic RPC access;
- reapplied privacy-safe Auth-user deletion constraints.

After replay, function execution counts matched current production exactly:

- `anon`: **1**
- `authenticated`: **30**
- `service_role`: **41**

Privacy FK behavior was restored to the current production standard:

- user-owned records continue to use `ON DELETE CASCADE` where appropriate;
- historical administrator/creator/audit references use `ON DELETE SET NULL`;
- the restored audit table had **0 orphan target-user references** after privacy migration replay.

The Supabase security advisor then matched the reviewed production database baseline: five informational `RLS Enabled No Policy` findings and the previously reviewed authenticated SECURITY DEFINER surface, with **no anonymous SECURITY DEFINER warning**.

## Manual reconfiguration confirmed by the exercise

Supabase Restore-to-New-Project restores database schema, data, indexes, roles, permissions, and database users, but does **not** fully recreate project-level configuration. The exercise confirmed the following must be restored/reconfigured separately before a recovered project could serve production traffic:

1. **Edge Functions** — the restored project contained **0 Edge Functions** immediately after database restore. CompassU production currently uses nine active Edge Functions.
2. **Auth settings** — leaked-password protection was disabled in the restored project even though it is enabled in production; MFA/provider settings and other Auth configuration must be revalidated.
3. **API keys/secrets** — recovered projects receive different project credentials and environment configuration must be updated safely.
4. **Storage objects/settings** — must be restored/reconfigured separately if used.
5. **Database extension/settings differences** — must be checked and normalized as part of recovery.
6. **Application hosting configuration** — Vercel environment variables and routing must point to the recovered Supabase project only after validation.
7. **Transactional email configuration** — Resend/API secrets and sender configuration must be revalidated before enabling email workflows.

## Monitoring evidence during Item #6

- Supabase production status: `ACTIVE_HEALTHY` at validation.
- Vercel production runtime-error check: no runtime error clusters found in the checked 24-hour window.
- Production monthly-report delivery log contained a successful `sent` event.

## RTO/RPO interpretation

The exercise proved that a recent daily backup can be restored to a separate healthy project and that CompassU data can be validated without modifying production.

The current internal recovery planning targets remain:

- **RPO: 24 hours** — consistent with the daily-backup baseline. This is a planning maximum, not a contractual guarantee.
- **RTO: 4 hours** — remains a conservative internal planning target because full service restoration also requires Edge Function deployment, Auth/project configuration, secrets/environment-variable restoration, application smoke testing, and traffic cutover. The database restore itself completed well within that window during this exercise.

Future use of PITR, if enabled, could materially reduce RPO and should be evaluated separately against cost and pilot requirements.

## Recovery runbook requirement

For any real recovery from a historical backup:

1. restore the selected backup to a new isolated project;
2. verify project health and historical snapshot integrity;
3. replay every migration newer than the backup timestamp;
4. run security advisors and compare execution grants/FK semantics to the production baseline;
5. deploy all required Edge Functions;
6. restore Auth settings, secrets, API configuration, Storage settings, and email configuration;
7. execute critical application smoke tests;
8. only then update application environment variables/routing and cut over traffic;
9. reapply any deletion/privacy instructions that may have been reintroduced by the restored backup where required.

## Cost control

Temporary development branches were deleted after validation. The Restore-to-New-Project exercise displayed $0 additional monthly compute/disk cost when created. The temporary restored project should be paused or deleted after evidence collection so it cannot be mistaken for production or accumulate future resource usage.

## Outcome

**Schema reconstruction parity: PASS.**  
**Production-data backup restore: PASS.**  
**Post-backup privacy/security migration replay: PASS.**

Item #6 recovery testing is technically complete. Remaining Item #6 work is limited to finalizing the monitoring/alerting operating checklist and dispositioning the temporary restored project.