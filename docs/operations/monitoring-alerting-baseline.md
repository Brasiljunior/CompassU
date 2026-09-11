# CompassU Monitoring & Alerting Baseline

**Launch Readiness Item:** #6 — Monitoring, Incident Response & Recovery Testing  
**Baseline date:** 2026-09-11  
**Status:** In progress

## Purpose

Define the monitoring sources, verified controls, escalation signals, and remaining gaps required for the CompassU pilot. This baseline uses native Vercel, Supabase, application audit/delivery records, and provider-status monitoring first so CompassU does not add another production subprocessor solely for monitoring without a separate privacy/security review.

## Verified current state

### Vercel

- CompassU is hosted on Vercel Pro.
- The production project is available through the existing Vercel project/team configuration.
- A fresh 24-hour production runtime-error check on 2026-09-11 returned **no runtime error clusters**.
- Vercel deployment status remains a primary signal for failed builds/deployments.
- Existing Vercel spend budget notifications remain part of the infrastructure-cost monitoring baseline.

### Supabase

- Production project status verified as **ACTIVE_HEALTHY** in `us-east-1` on PostgreSQL 17.
- Security advisors remain at the reviewed baseline: five informational RLS/no-policy findings for server-managed administrative tables plus the previously reviewed authenticated SECURITY DEFINER RPC surface.
- Clean disaster-recovery reconstruction now passes with parity for 29 public tables, 41 public application functions, 82 indexes, one trigger, execution grants, and the Supabase Edge Function surface.
- Supabase project health, security advisors, Edge Function state, database availability, Auth availability, and migration state are required operational signals.

### Transactional and institutional email

- CompassU uses Resend for transactional email.
- The application maintains persistent delivery-history records for institutional monthly reporting.
- Current delivery-log verification shows a successful `sent` record and no failed monthly-report delivery record in the existing production log at the time of this baseline.
- Provider message IDs and application error fields should remain part of troubleshooting evidence whenever available.

### Administrative/security telemetry

- `admin_audit_log` is the authoritative application-side audit trail for administrator actions.
- Administrator MFA remains required for protected administrator workflows.
- Authentication, role-scope, deletion/de-identification, account-management, and reporting actions are critical incident review areas.

## Pilot monitoring signals

The following signals should be reviewed during pilot operations:

| Area | Signal | Escalation condition |
|---|---|---|
| Public application | Vercel production deployment/runtime health | Failed production deployment, repeated 5xx/runtime failures, or public site unavailable |
| Supabase database | Project health/database reachability | Project not ACTIVE_HEALTHY, connection failures, or material database errors |
| Auth | Login/signup/password-reset failures | Sustained or multi-user failures not attributable to user input |
| Assessment | Save/finalize/results failures | Repeated inability to autosave, finalize, score, or retrieve results |
| Email | Transactional delivery failures | Repeated send failure, provider rejection, or institutional report failure |
| Administrator workflows | MFA/account-management failures | Administrator cannot authenticate or perform required pilot support operations |
| Privacy/data governance | Deletion/de-identification failure | Valid deletion cannot be completed or removed user data unexpectedly reappears |
| Security | Advisor regression or anomalous admin activity | New critical/high-risk finding or suspicious privileged activity |
| Cost/capacity | Provider spend/usage thresholds | Unexpected usage acceleration or spend-alert threshold reached |

## Severity alignment

- **SEV-1 Critical:** broad outage, confirmed sensitive-data exposure, loss/corruption of production data, or administrator compromise with material impact.
- **SEV-2 High:** major pilot workflow unavailable for many users, substantial authentication/assessment failure, or repeated email/reporting outage.
- **SEV-3 Medium:** limited workflow degradation with workaround available.
- **SEV-4 Low:** isolated defect or informational monitoring event with no material service impact.

The incident workflow and recovery checklist are maintained in `docs/operations/incident-response-recovery.md`.

## Native-first monitoring decision

No dedicated third-party application-error-monitoring processor has been added as part of this baseline. Vercel runtime telemetry, Supabase health/advisors, provider delivery status, and CompassU's own audit/delivery records are being used first. Adding a service such as Sentry would create an additional production data processor/subprocessor and should therefore receive a separate technical and privacy review before implementation.

## Remaining Item #6 monitoring gaps

1. Confirm the exact enabled notification channels/recipients for infrastructure and deployment alerts.
2. Confirm provider-status escalation procedures for Vercel, Supabase, and Resend.
3. Establish a repeatable production health-check cadence for the pilot support period.
4. Complete a controlled **production-data backup restore** exercise in a non-production target. The schema/backend reconstruction test is already complete, but it does not prove backup-data restoration.
5. Measure the data-restore duration and use that evidence to validate or revise the provisional internal RTO of 4 hours and RPO of 24 hours.
6. Verify emergency administrator credential-recovery/rotation procedures without weakening MFA.

## Current conclusion

The application has a workable native monitoring foundation for a pilot, and no active critical operational signal was observed during this baseline check. Item #6 is **not yet closed** because notification-path verification and the controlled production-data backup restore test remain outstanding.