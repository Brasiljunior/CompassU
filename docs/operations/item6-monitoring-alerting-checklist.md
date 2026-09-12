# CompassU Item #6 Monitoring & Alerting Operating Checklist

**Purpose:** Production operating checklist for CompassU pilot readiness.

## Daily production health

- Confirm Supabase project status is `ACTIVE_HEALTHY`.
- Review Supabase security/performance advisors for new critical/high-impact findings.
- Review Vercel production runtime errors for the prior 24 hours.
- Review failed transactional email/report delivery events.
- Review administrator audit events for unexpected privileged actions.
- Confirm no temporary recovery/test environment is serving production traffic.

## Deployment monitoring

For each production deployment:

1. Confirm Vercel deployment reaches READY.
2. Review build/runtime errors before and after release.
3. Smoke-test public landing page and authentication.
4. Smoke-test assessment start/resume/autosave/finalization.
5. Smoke-test results/PDF/email delivery where applicable.
6. Smoke-test administrator MFA/login and account-management workflows.
7. Validate institutional reporting access boundaries.

## Supabase monitoring

- Production health status.
- Security advisor output.
- Performance advisor output.
- Database size/growth.
- Auth user growth.
- Assessment attempt/response growth.
- Edge Function status and JWT verification.
- Migration status and schema drift.
- Backup availability and recency.

## Vercel monitoring

- Runtime error clusters.
- 5xx errors.
- Failed deployments/builds.
- Unexpected function/runtime changes.
- Spend/budget notifications.

## Email monitoring

- Transactional email failures.
- Monthly institutional report delivery failures.
- Invitation delivery failures.
- Provider outage/status checks when failures spike.

## Incident severity

- **SEV-1 Critical:** broad outage, suspected data breach, data corruption/loss, administrator compromise, inability to authenticate at scale.
- **SEV-2 High:** major workflow unavailable for a material subset of users; repeated report/email or assessment finalization failure.
- **SEV-3 Moderate:** isolated functional defect with workaround and no data-loss risk.
- **SEV-4 Low:** cosmetic/minor issue without material user impact.

## Recovery baseline

- Internal planning RTO: **4 hours**.
- Internal planning RPO: **24 hours** with daily backup baseline.
- These are operational planning targets, not contractual guarantees.
- Recovery must use Restore-to-New-Project or another isolated environment; do not overwrite production during a test.
- After restore, replay migrations newer than the backup snapshot and reconfigure Edge Functions, Auth settings, secrets/API keys, Storage, and application environment variables before cutover.

## Escalation triggers

Immediately open an incident record when any of the following occurs:

- sustained production outage or repeated 5xx errors;
- Supabase unhealthy/degraded status affecting CompassU;
- suspected unauthorized administrator access;
- evidence of student-data exposure, deletion, corruption, or cross-institution access;
- assessment finalization/data persistence failure affecting multiple students;
- transactional email/reporting failure that materially affects pilot operations;
- backup/restore failure or missing expected backup.

## Closure requirement

An incident is not closed until service is stable, root cause is understood or bounded, necessary security/privacy actions are complete, and corrective actions are documented.