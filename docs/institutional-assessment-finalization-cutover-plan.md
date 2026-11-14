# Assessment finalization cutover plan (not deployed)

## Existing flow verified in staging
- `app/page.js` calls `public.finalize_assessment(uuid)` directly after 80 responses.
- `loadResults()` calls the same RPC again if major matches are missing, so repeated calls must remain safe.
- `finalize_assessment` currently runs as SECURITY INVOKER, verifies `auth.uid()` owns the attempt, checks at least 80 responses, writes scored major matches, and updates completion status.
- Authenticated users have UPDATE on `assessment_attempts.status`, `completed_at`, and `user_id`, under an owner-only RLS policy. A status-change trigger alone is unsafe.

## Atomic cutover required
1. In a single transaction, introduce a hardened finalization function that retains the public RPC signature and result shape. Use SECURITY DEFINER only with a trusted owner, `SET search_path = ''`, schema-qualified tables and functions, and explicit `auth.uid()`/attempt ownership validation. Do not take a tenant or student ID from the caller.
2. Serialize completion by locking the owned attempt row. Reject ownership changes, invalid transitions, and insufficient responses. Ensure repeated invocations do not create new completion events.
3. Preserve the scoring semantics and major-match output. Confirm existing score functions work under the intended privilege context; they depend on `auth.uid()`.
4. Revoke broad authenticated UPDATE on `assessment_attempts` and grant only the specific columns needed for legitimate in-progress edits. Restrict INSERT columns as necessary to prevent client-created completed attempts or forged ownership.
5. In the same trusted completion transaction, read an independently verified `institution_student_assignments` record. Only capture `institution_assessment_affiliations` if verification predates completion. Do not infer institution from staff membership or email.
6. Do not enqueue or email in the finalization transaction. Outbox eligibility must separately require per-assessment authorization, active verified recipient, institutional enablement, and summary-only mode.
7. Validate that regular assessments still complete without any institutional assignment, and that result reloads still work.

## Security regression tests before staging cutover
- A user cannot PATCH status or completed_at to forge completion.
- A user cannot PATCH user_id to transfer an attempt.
- A user cannot POST an already-completed attempt or set completed_at on INSERT.
- A user cannot finalize another user's attempt.
- A user with fewer than 80 responses cannot finalize.
- A valid owner with enough responses can finalize and receive the expected ranked matches.
- Reopening results is idempotent and does not reauthorize delivery.
- An unassigned student completes normally without an institutional snapshot.
- A verified student gets one immutable snapshot, with institution and evidence from the trusted assignment.
- A verification timestamp later than completion never yields a snapshot.
- Concurrency cannot create duplicate or conflicting snapshots.
- No institutional delivery job is created without independent authorization.

## Rollout
Deploy first to the isolated staging project, with synthetic accounts and no outbound email. Capture pre/post permissions and run every regression test. Do not enable production delivery or modify production permissions without explicit approval.
