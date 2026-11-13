# Institutional student affiliation: staging finding

**Blocking issue — do not activate completion-driven institutional delivery.**

Read-only inspection of the CompassU staging database on 2026-11-13 found:

- `institution_memberships.role` allows `institution_admin` and `counselor` only.
- 22 completed assessment attempts exist; only 1 belongs to an account with an active row in `institution_memberships`.
- The current `institutionalCompletionBridge.mjs` derives the student's tenant from that membership table. This is not a validated student-to-institution mapping and must not be treated as proof that an institution is entitled to the assessment.
- The draft delivery schema has not been applied to staging.

## Required remediation before enabling reconciliation writes

1. Identify the canonical, trusted student-to-home-institution relationship in the deployed application and database. Do not use administrator/counselor membership as a substitute.
2. Ensure the institution association is immutable for the completed assessment or has an auditable snapshot. Do not trust a browser-supplied tenant ID.
3. Require an independent per-attempt authorization/consent record and institution-wide authorization before enqueueing.
4. Fail closed for missing or conflicting affiliations; test cross-institution and account-reassignment cases.
5. Only after these checks, update the completion bridge and its tests and run staging end-to-end tests with synthetic student accounts.

No schema migrations, production changes, or notification dispatch were performed during this inspection.

## Follow-up staging evidence

The existing `account_institutions` table includes `email`, `institution`, and `tenant_institution_id`. A read-only join from completed attempts through the current `auth.users.email` to this table matched **13 completed assessments** to a non-null tenant ID (2026-11-13). This is a coverage observation, **not** proof of consent or an immutable student-institution affiliation: emails and account assignments can change. Do not authorize report delivery from this join alone. The intended design should capture a trusted tenant snapshot at assessment completion and validate an independent per-attempt authorization before queuing delivery.

## Additional invitation-schema inspection (2026-11-13)

Read-only staging schema inspection found `admin_role_invitations` with
`tenant_institution_id`, `accepted_by`, and `accepted_at`, but those
invitations concern administrator roles and cannot prove student affiliation.
`batch_invitation_report_items` stores email and delivery status, but does not
contain a tenant institution ID or a verified assessment-attempt ID.
`account_institutions` contains a tenant ID but remains email-keyed and mutable.

**Implementation requirement:** establish a server-controlled, authenticated
student-to-tenant assignment with a documented provenance record, then
atomically snapshot that assignment against the specific assessment attempt.
Do not backfill historical attempts from current account email, batch email
delivery logs, or administrator invitations. Independently capture and verify
per-attempt authorization; no notification should be queued without both.
