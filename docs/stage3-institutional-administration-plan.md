# CompassU Stage 3 — Institutional Administration & Scalability

## Purpose
Stage 3 establishes the multi-tenant administration foundation required to onboard and safely operate multiple institutional customers without changing CompassU assessment scoring or recommendation logic.

## Non-negotiable safeguards
- Production remains the stable baseline until Stage 3 is explicitly approved for release.
- Existing `account_institutions` assignments continue to function during migration.
- Existing `admin_users` master-administrator access remains compatible during migration.
- Tenant isolation is enforced in the database, not only in the UI.
- Aggregate analytics retain the existing small-cell suppression threshold of 5.
- No new demographic/cohort fields are invented. Cohort capabilities use only captured fields until new fields are deliberately introduced.
- Assessment scoring, major matching, occupation mapping, and recommendation algorithms are out of scope for modification.

## Stage 3A — Customer & Institution Architecture
Introduce durable identifiers instead of using institution-name strings as the long-term tenant boundary.

Planned entities:
- `organizations`: customer/system/district-level tenant.
- `institutions`: individual schools, colleges, campuses, or participating institutions belonging to an organization.
- `organization_memberships`: user-to-organization administrative membership.
- `institution_memberships`: user-to-institution administrative/advising membership.

Initial hierarchy:
`CompassU Master Admin -> Organization/System -> Institution -> Institution Admin / Counselor-Advisor`

Migration principle: existing `account_institutions.institution` values will be mapped to institution records through an explicit migration/backfill process. The existing column will not be removed in Stage 3A.

## Stage 3B — Role-Based Administration
Target roles:
- `master_admin`: all CompassU customers and institutions.
- `system_admin`: assigned organization/system and its institutions.
- `institution_admin`: assigned institution(s).
- `counselor`: future advising/cohort access within assigned institution(s).

Authorization must be server/database enforced. UI visibility is secondary to authorization.

## Stage 3C — Institutional User Management
Authorized administrators will manage administrative memberships within their permitted tenant scope. Cross-customer assignment must be blocked at the database layer.

## Stage 3D — Cohorts & Student Organization
Build cohort-ready structures around data CompassU actually captures. Initial supported segmentation can include institution, assessment status, assessment date/reporting period, and graduation year where present. Additional fields require a separate schema/product decision before implementation.

## Stage 3E — District/System Analytics
Extend the validated Stage 2 aggregate analytics model to authorized organization/system rollups. Maintain latest-canonical-assessment semantics, reporting-period behavior, aggregate-only reporting, and small-cell suppression.

## Stage 3F — Institutional Onboarding & Configuration
Create repeatable customer setup and institution configuration workflows, including tenant creation, institution setup, administrator assignment, and readiness validation.

## Stage 3A implementation sequence
1. Create additive organization/institution/membership schema.
2. Add helper authorization functions that resolve the current user's tenant scope.
3. Create an idempotent migration/backfill path from existing institution-name assignments.
4. Preserve existing master-admin behavior while tenant-scoped roles are introduced.
5. Add database-level tenant-isolation policies/functions.
6. Build a Stage 3A admin/readiness view in the test environment.
7. Validate existing Stage 1/2 workflows against the additive schema before moving to Stage 3B.

## Release gates
Stage 3A is not complete until:
- existing student assessment workflows remain functional;
- existing Stage 2 analytics and PDFs remain functional;
- master admins retain expected access;
- a tenant-scoped administrator cannot access another tenant's protected data;
- migration/backfill can be rerun safely;
- the user completes acceptance testing in the CompassU test environment.
