# CompassU Post-Stage 2 Development Policy

## Decision
CompassU will retain Stage 1 and Stage 2 as the permanent production feature boundary for the current product direction. Stage 3 and Stage 4 delegated institutional administration will not be implemented.

## Production boundary
The production application remains based on commit `cfac1713d3f97344dc6f817340cbeb3eca9c21f3`, which contains the validated Stage 2 release.

Production retains:
- Stage 1 assessment, scoring, recommendations, reports, email/PDF workflows, and Master Administrator functions.
- Stage 2 Institutional Analytics, reporting periods, institution comparison, Institutional Trends, Executive Institutional Insights, privacy safeguards, and institutional PDF exports.

Production excludes:
- District/System Administrator access.
- Institution Administrator access.
- Counselor/Advisor delegated administrative access.
- Customer-facing administrator invitation or provisioning workflows.
- Stage 4 functionality dependent on delegated administration.

## Institutional data model
Institution associations required for Stage 2 reporting may remain. These associations support centralized institutional analytics and do not imply delegated customer access.

## Stage 3 code archive
Stage 3 development history is preserved on the Git branch:
`archive-stage3-institutional-admin`

The former development branch `stage3-institutional-admin` has been reset to the Stage 2 production baseline so it no longer carries active Stage 3 code.

Future development should begin from:
`development-post-stage2`

## Database policy
Stage 3 database objects already installed in Supabase should remain dormant unless a future technical review determines they create an operational or security concern. No new tenant administrator memberships or invitations should be created. Do not remove shared institution-assignment structures that Stage 2 analytics relies on.

Destructive database rollback is intentionally deferred because the current production code does not expose Stage 3 functionality and unnecessary schema deletion could introduce avoidable risk.

## Operating model
CompassU administration remains centralized under the CompassU Master Administrator. Institutional customers receive analytics, reports, and deliverables through CompassU rather than receiving administrative portal access.

## Change control
Any future proposal to reintroduce delegated institutional administration must be treated as a new product decision and must not be merged into production without explicit approval, security validation, tenant-isolation testing, and user acceptance testing.
