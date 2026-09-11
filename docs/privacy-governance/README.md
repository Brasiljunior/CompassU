# CompassU Privacy & Data Governance Package

Status: technically validated production-governance baseline; final legal identity/jurisdiction fields and counsel review remain before broad commercial publication
Effective-date placeholder: to be set before pilot launch

## Governing product position

CompassU is an educational career and college discovery service. Institution-provided student information is processed to provide, secure, support, improve, and administer the CompassU educational service and authorized institutional reporting.

CompassU does not sell student personal information, use student personal information for targeted advertising, or use institution-provided student information to create unrelated commercial profiles.

## Administrative control model

Technical authority to access administrative records, modify accounts, export identifiable student data, execute retention actions, or delete student accounts/data remains exclusively with authorized CompassU Master Administrators.

Participating institutions do not receive direct database access or unrestricted deletion privileges. An institution may submit an authenticated request concerning records under its authority. CompassU validates the request and an authorized CompassU Master Administrator executes an approved request.

This distinction is intentional: the institution retains contractual/legal request rights while CompassU retains technical execution authority.

## Package components

1. `privacy-notice.md` — public-facing Privacy Notice.
2. `terms-of-service.md` — public-facing Terms of Service.
3. `institutional-dpa-ferpa-addendum.md` — institutional DPA and FERPA-oriented provisions.
4. `minors-coppa-policy.md` — minors and COPPA operating standard.
5. `retention-deletion-standard.md` — verified data-lifecycle/deletion standard.
6. `subprocessors.md` — verified production-service subprocessor baseline.
7. `security-breach-commitments.md` — security and incident commitments.
8. `institutional-privacy-summary.md` — procurement/privacy review summary.

## Verified CompassU data categories

Production inventory confirms processing of account/institution assignments, authentication/account metadata, assessment attempts, individual assessment responses, major recommendation results, favorites, administrator/audit data, invitations, and institutional reporting recipient/delivery information. CompassU also generates downloadable assessment reports and sends assessment results by email.

Institutional analytics should be aggregate by default, institution-scoped server-side, omit names/emails from standard aggregate reports, and suppress small cells below five students.

## Technical validation completed September 11, 2026

- Production account deletion was verified against the database schema and Master Administrator deletion path.
- User-owned student records cascade on Auth-user deletion where appropriate.
- Historical administrative/audit references that must remain are de-identified with `ON DELETE SET NULL` rather than blocking deletion or destroying event history.
- Previously orphaned audit target identifiers were de-identified.
- Supabase Pro's current daily-backup baseline and seven-day accessible daily-backup window were incorporated into the retention standard; PITR status must be separately verified if enabled because the available project connector does not expose that add-on state.
- Direct production subprocessors currently verified are Supabase, Vercel, and Resend. Current application dependencies do not include a direct OpenAI, Anthropic, advertising, or product-analytics SDK.

## Legal implementation principles

- FERPA: where an institution relies on the school-official exception, CompassU performs the contracted institutional service, remains subject to institutional direct-control provisions governing use and maintenance of education records, limits use to authorized purposes, and restricts redisclosure.
- COPPA: CompassU is designed primarily for high-school juniors/seniors and college freshmen. If an under-13 school-sponsored deployment is authorized, information must be limited to the school-authorized educational purpose. School authorization cannot be used to support unrelated commercial use.
- Requests: rights of institutions, parents, eligible students, or other authorized parties are handled through an authenticated request process. CompassU Master Administrators remain the technical operators who execute approved access/export/correction/deletion actions.
- Data minimization: collect and retain only data reasonably needed for the service, security, support, legal obligations, and authorized institutional reporting.
- De-identification: aggregated/de-identified information must not reasonably identify a student; small-cell suppression is a baseline safeguard, not the only safeguard.

## Remaining pre-publication fields

Before the Privacy Notice and Terms are treated as final legal publications, CompassU must insert its legal/business entity name, business mailing address, privacy/legal contact email address(es), effective date, and governing-law/venue language. Warranty, limitation-of-liability, indemnification, and dispute-resolution provisions should receive qualified legal review.

## Launch status

The technical privacy/data-governance implementation is materially aligned for pilot readiness. The remaining #5 work is legal finalization rather than an unresolved application or database defect. These materials are not a substitute for legal advice and may still require institution- or state-specific addenda.
