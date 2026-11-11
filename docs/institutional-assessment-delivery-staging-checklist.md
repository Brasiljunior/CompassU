# Institutional assessment delivery: staging acceptance checklist

This feature is **not ready for production or institutional emails** until every gate below is verified.

## Gate 1 — database
- [ ] Apply reviewed schema to the separate CompassU test project only.
- [ ] Confirm all three new tables have RLS enabled, and anon/authenticated cannot read or write them.
- [ ] Confirm foreign keys and unique constraints reject cross-institution recipient/job combinations.
- [ ] Confirm report delivery defaults to disabled.
- [ ] Confirm recipient verification is performed by a trusted administrative workflow; never let a browser set verified_at.
- [ ] Confirm user-institution linkage is canonical and not editable by the student.

## Gate 2 — authorization
- [ ] Establish a verified consent or institutional authorization record server-side; never trust a request's consentApproved flag.
- [ ] Verify the assessment's owner and institutional affiliation using trusted database records.
- [ ] Authorize every master-admin action using verified user identity and privileged role records.
- [ ] Confirm revocation disables future delivery and invalidates report access.
- [ ] Determine FERPA/parental-consent and student-age requirements with institutional counsel.

## Gate 3 — functionality
- [ ] Implement institution settings and recipient management UI.
- [ ] Implement a durable, authenticated queue trigger after completion.
- [ ] Implement a worker with retries, idempotency, and a failed-delivery dashboard.
- [ ] Implement both full and executive-summary reports and verify content against student results.
- [ ] Implement a protected report viewer; do not email sensitive report attachments.
- [ ] Preserve existing student results email flow.

## Gate 4 — tests
- [ ] Execute unit tests in CI; review results.
- [ ] Test multiple institutions, duplicate attempts, unverified recipient, revoked access, missing consent, and incomplete attempt.
- [ ] Test sending only to controlled test inboxes with synthetic student data.
- [ ] Verify access denied to a recipient from a different institution.
- [ ] Run Supabase security advisors and remediate findings.
- [ ] Confirm test Vercel deployment URL and record a successful end-to-end test.

## Gate 5 — launch
- [ ] Obtain explicit approval for production activation after a successful test demonstration.
- [ ] Enable institutions individually, with authorization and verified recipients.
