# CompassU Incident Response & Recovery Runbook

**Status:** Pilot operational baseline
**Owner:** CompassU Master Administrator / designated incident lead
**Review cadence:** Before pilot launch, after any Severity 1/2 incident, and at least annually

## Objectives

CompassU will detect, contain, investigate, recover from, and document material service, security, privacy, and data-integrity incidents. This runbook applies to the CompassU application, Vercel deployment/runtime, Supabase database/authentication/Edge Functions, Resend transactional email, and related administrative workflows.

## Severity model

### SEV-1 Critical
Production unavailable for a substantial portion of users; confirmed or strongly suspected unauthorized access to student/admin data; destructive data loss/corruption; administrator account compromise; or widespread authentication failure.

**Initial response target:** acknowledge/escalate immediately when detected. Begin containment and provider escalation as the highest priority.

### SEV-2 High
Material degradation affecting an institution or important workflow; repeated assessment finalization/email/report failures; credible security event without confirmed material exposure; or recoverable data-integrity issue.

**Initial response target:** same operational day when detected, with accelerated response during an active pilot window.

### SEV-3 Moderate
Limited user-impacting defect, isolated integration failure, or operational issue with a viable workaround.

### SEV-4 Low
Cosmetic/non-urgent issue, documentation defect, or low-risk anomaly.

## Detection sources

- Vercel deployment state, build logs and runtime errors/status codes.
- Supabase project health, security/performance advisors, database/authentication/Edge Function behavior.
- Resend delivery failures and provider status/usage information.
- CompassU administrator audit records and user/institution reports.
- Pilot support reports and manual smoke tests.

## Incident workflow

1. **Detect and record:** timestamp, reporter/source, affected environment, institution/user scope, observed symptoms and known request/deployment identifiers.
2. **Classify:** assign severity and incident lead. Treat suspected student-data exposure as at least SEV-2 until scoped.
3. **Contain:** stop harmful automation, disable/revoke compromised access, isolate a bad deployment, pause risky administrative actions, or restrict affected functionality as appropriate.
4. **Preserve evidence:** retain relevant application/provider logs, audit events, deployment/commit identifiers and investigation notes. Do not copy unnecessary student content into incident notes.
5. **Investigate:** establish start time, affected systems/users/data, root cause, whether data confidentiality/integrity/availability was affected, and whether provider escalation is required.
6. **Recover:** restore a known-good deployment/configuration/data state, validate critical workflows, reapply any deletion instructions if a backup restoration reintroduces previously deleted data, and monitor for recurrence.
7. **Notify/communicate:** provide operational updates to affected institutions/users when appropriate. For a suspected breach, coordinate legal/privacy notification decisions using applicable law and contracts; do not promise a universal fixed statutory deadline without counsel review.
8. **Close:** document resolution, root cause, corrective actions, evidence retained, communications, and follow-up owner/due date.
9. **Review:** SEV-1/2 incidents require a post-incident review and tracked corrective actions.

## Critical recovery checks

After a material recovery, verify at minimum:

- public site loads and authentication works;
- student can start/resume an assessment and autosave responses;
- assessment finalization produces expected recommendations;
- results/report download works;
- transactional email path works;
- administrator login/MFA and account management work;
- institution scoping/reporting remains correct;
- deletion/de-identification controls remain intact;
- no unexpected Supabase security-advisor regression is introduced.

## Recovery objectives for pilot

Until measured under Item #4 load/concurrency testing and a completed restoration exercise, CompassU will use **provisional** objectives rather than contractual SLAs:

- **RTO planning target:** restore critical pilot service within 4 hours of a recoverable CompassU-controlled outage.
- **RPO planning target:** no more than 24 hours for database disaster recovery based on the current daily-backup baseline, while application deployments/configuration should normally be recoverable from source control/provider history with substantially less loss.

These are internal planning targets, not customer guarantees. They must be revised after the recovery exercise and pilot load test.

## Backup and restore controls

- Supabase production backup lifecycle is documented in the privacy-governance retention standard.
- A restoration must be performed only by an authorized administrator using an approved recovery procedure.
- Before restoration, record the incident/recovery reason and recovery point selected.
- After restoration, reconcile account deletions/privacy requests executed after the selected recovery point and reapply them where necessary.
- Validate referential integrity, authentication, assessment completion, reporting and administrative workflows before declaring recovery complete.

## Emergency administrator access

- Master Administrator accounts must retain MFA.
- Emergency access must use an individually attributable administrator identity; shared credentials are prohibited.
- Credential reset/recovery actions must be recorded.
- Suspected administrator compromise requires immediate session/credential remediation and review of administrative audit history.

## Communications template fields

For material incidents record: incident ID, severity, start/detection time, systems affected, known user/institution impact, containment status, next update point, resolution time, and post-incident action owner.

## Pilot readiness gate

Before Item #6 is considered fully closed, CompassU should complete a controlled backup/recovery exercise, validate alert/monitoring configuration available in each production provider, and record the result. Item #4 will subsequently test performance/concurrency and may cause RTO/RPO or alert thresholds to be adjusted.