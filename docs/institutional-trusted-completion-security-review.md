# Trusted assessment completion — staging security finding

## Verified staging behavior (2026-11-14)
- `public.finalize_assessment(uuid)` is SECURITY INVOKER, checks `auth.uid()` ownership and at least 80 assessment responses, recalculates major matches, and updates `assessment_attempts.status` to completed.
- `assessment_attempts` has an authenticated `users_update_own_attempts` RLS policy that checks ownership only. It does not restrict status or completed_at changes.
- Therefore an `AFTER UPDATE status` trigger would not prove that `finalize_assessment` ran: a user may be able to update their own status directly. Do not attach an institution snapshot capture trigger to the table in this state.
- The newly installed delivery schema is staging-only, with disabled settings, inactive recipients, and no public/authenticated table grants.

## Required implementation gates
1. Inspect existing application writes to `assessment_attempts` before changing any RLS or grants. Preserve legitimate in-progress updates.
2. Design a narrowly scoped completion authority that cannot be spoofed by a direct client update. Avoid a general SECURITY DEFINER function that lets users submit arbitrary tenant IDs.
3. Record a verified student-to-institution assignment **before** completion. Capture the immutable assessment snapshot in the same trusted transaction as finalization, without breaking ordinary students who lack verified affiliation.
4. Verify ownership, minimum responses, status transition, timestamp, and snapshot consistency in isolated staging tests.
5. Require separate assessment-specific authorization, active verified recipient, institution enablement, and summary-only policy before any job is queued.
6. Do not backfill historical assessments or send real emails. Do not change production without explicit approval.

## Current code limitation
`lib/institutionalCompletionSnapshotCapture.mjs` is a standalone server-only helper, not wired into the trusted finalization transaction. Its five-minute clock guard is only defense in depth and cannot establish the provenance of completion. It must not be exposed as a public endpoint or invoked based on client-supplied completion claims.
