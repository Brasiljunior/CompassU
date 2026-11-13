# Institutional reconciliation staging validation

**Status: not approved for production.** These steps are for an isolated staging environment only.

## Preconditions
1. Verify the test project, not the production Supabase project, is selected.
2. Review and apply the institutional delivery schema and its RLS grants in staging only, after backup and migration review.
3. Confirm `assessment_attempts` has `id`, `status`, and `completed_at`; ensure the service role can read it.
4. Use a staging deployment with `INSTITUTIONAL_RECONCILIATION_PREVIEW_ENABLED=true`, a unique random server-only `INSTITUTIONAL_RECONCILIATION_SECRET` of at least 32 characters, and staging Supabase URL/service-role key. Never expose either secret with a `NEXT_PUBLIC_` prefix.
5. Keep `INSTITUTIONAL_REPORTS_ENABLED` unset/false. Do not enable any delivery worker, email dispatch, or production cron.

## Validation
1. Run institutional tests, pilot regression tests, and the Next.js production build in CI.
2. Without authorization, GET `/api/institutional-reconciliation/preview` must return 401 (or 503 when the feature flag is disabled).
3. With the staging secret, GET must return only `dryRun`, `candidateCount`, and `potentiallyMoreCandidates`. It must not contain assessment IDs, student data, or report contents.
4. Confirm there are **no inserts/updates** to delivery jobs and **no emails sent**.
5. Compare the 24-hour candidate count with a read-only database query. A count of 50 with `potentiallyMoreCandidates=true` is incomplete, not a full count.
6. Remove the preview flag and verify GET returns 503. Rotate the staging secret if it was exposed.

## Remaining launch gates
- Build keyset pagination or an equivalent safe watermark before processing high-volume windows.
- Validate FERPA/institutional authority and consent capture; independently verify recipient membership.
- Review draft schema, service-role RPCs, and audit behavior in staging.
- Implement and verify trusted completion trigger, authenticated job processor, retries, and duplicate suppression.
- Implement authorized full-report access if that report mode will be offered.
- Run staging end-to-end tests including revocation, cross-institution access denial, account switching, and email failures.
- Obtain explicit approval before any production migration, deployment, feature enablement, or sending institutional notifications.
