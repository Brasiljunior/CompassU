# Institutional Assessment Results Delivery — implementation specification

Status: development branch; **not enabled in production**.

## Verified integration points
- `app/page.js`: `finishAssessment()` calls `finalize_assessment`, then `emailResults(attempt.id, true)`.
- `app/api/admin/monthly-reports/send/route.js`: existing institutional profile / Resend integration, for monthly reports only. Do **not** reuse monthly recipients implicitly for individual student records.
- `app/api/cron/invitation-reminders/route.js`: existing authenticated scheduled job pattern.
- `app/admin/page.js`: admin console calls authenticated Supabase `admin-console` function.
- `README.md`: requires validation in isolated `compassu-test` prior to production.

## Product requirements
1. Add master-admin-only 'Institutional Results Delivery' management with institution ID, active flag, delivery mode (full, summary, both), verified recipient records, consent/legal basis configuration, and per-institution status.
2. Never default to sending student-identifiable data to monthly reporting recipients. New recipient authorization is required.
3. Trigger on **server-verified completed attempt**, not on client-supplied institution, email, or arbitrary attempt ID.
4. Resolve institution from the authenticated student's immutable/validated institutional association, not from a caller-provided string.
5. Securely provide the report behind authenticated, institution-scoped access. Email contains no student result detail, no sensitive PDF attachment, and no reusable bearer token.
6. Summary and full views enforce identical authorization; report links can expire and be revoked. Audit access.
7. Persist a unique delivery job per attempt + institution + recipient + report type; retries must not duplicate sends.
8. Audit queued/sent/failed/skipped, provider ID, timestamps, and retry counts without storing sensitive report text in logs.
9. If consent/authorization or verified recipient is missing, **skip** institutional delivery while preserving student results.
10. Admins can configure recipients, pause delivery, view status, and retry failed jobs. Recipients must not access results from other institutions.
11. Avoid changing existing student email behavior.

## Proposed storage
- `institution_assessment_delivery_settings`: institution_id unique, enabled default false, mode check (full|summary|both), authorization policy reference, timestamps.
- `institution_assessment_recipients`: id, institution_id, email, display_name, verified_at, active, timestamps.
- `institution_assessment_delivery_jobs`: id, attempt_id, institution_id, recipient_id, report_type, state, retry_count, provider_id, last_error_code, created_at, sent_at; unique composite key.
- `institution_assessment_report_access`: authorized user identity, institution_id, attempt_id, grant/revocation/expiry, access log.

## Required engineering checks before schema or deployment
- Inspect actual Supabase assessment/user/institution schema, RLS policies, current admin authorization, `emailResults` implementation, and existing completion triggers.
- Determine whether minors are included; validate consent/FERPA disclosure basis and institutional contracts with counsel.
- Choose server-side transaction/outbox path for completion and backfill missed jobs; do not depend solely on browser execution.
- Verify provider domain and environment settings without exposing secrets.
- Add migrations with restrictive RLS and tests for cross-institution access, spoofed student IDs, revoked recipients, duplicate events, failed sends, and missing authorization.
- Test in `compassu-test` with synthetic students and approved test recipients; obtain explicit launch approval before enabling production.

## Acceptance criteria
- Admin can configure modes and authorized recipients for each institution.
- Completion creates exactly one intended delivery per recipient/report type.
- Both mode exposes both report types through secure institutional access.
- Unauthorized users cannot view any student report.
- Disabled/missing consent settings send nothing.
- Retries, logs, and manual resend work without duplicate exposure.
- Existing student results/email remain functional.

## Authorization source of truth

The server-side outbox now reads `institution_assessment_authorizations` for the completed attempt and checks matching tenant, approved status, evidence, approval timestamp, and absence of revocation. It does not accept a caller-provided consent flag. The assessment-completion integration must create this record through a separately authorized, audited workflow; no UI or client can self-approve authorization. This feature remains disabled until the lawful authorization mechanism and report viewer are verified in staging.
