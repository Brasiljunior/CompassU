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
