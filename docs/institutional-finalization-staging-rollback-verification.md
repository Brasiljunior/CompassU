# Trusted finalization staging rollback verification — 2026-11-14

Scope: isolated staging project only. Production and existing staging function remain unchanged.

## Executed checks

1. Executed the entire `supabase/institutional-trusted-finalization-cutover-DRAFT.sql` inside `BEGIN ... ROLLBACK`. SQL completed without installation errors.
2. Inside the transaction, `finalize_assessment(uuid)` had `prosecdef=true`, authenticated direct `UPDATE(status)` was false, and authenticated `INSERT(user_id)` was true.
3. Repeated the transactional installation and called `finalize_assessment` with no authenticated user and a synthetic nonexistent attempt UUID. The function raised the expected `Authentication required` error; the test caught and asserted the exact error. Transaction rolled back.
4. Existing staging has no verified student assignments or institutional affiliation snapshots. No synthetic student accounts were created or real emails sent.

## Not yet validated

- A real authenticated synthetic student's assessment completion and scored result shape.
- Row-level-security interactions under authenticated JWT with 80+ synthetic responses.
- Completion-time snapshot insertion with a verified assignment.
- Repeat completion and missing-match recovery.
- Concurrent calls and unauthorized attempt ownership.
- Production cutover.

**Do not deploy the draft** until those functional regressions pass. A SQL compilation/permission smoke test is not an end-to-end assessment test.
