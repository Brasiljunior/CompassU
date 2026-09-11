# CompassU Privacy & Data Governance Package

Status: production legal draft for counsel review
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
5. `retention-deletion-standard.md` — data lifecycle standard.
6. `subprocessors.md` — production subprocessor disclosure framework.
7. `security-breach-commitments.md` — security and incident commitments.
8. `institutional-privacy-summary.md` — procurement/privacy review summary.

## Verified CompassU data categories

Production inventory confirms processing of account/institution assignments, authentication/account metadata, assessment attempts, individual assessment responses, major recommendation results, favorites, administrator/audit data, invitations, and institutional reporting recipient/delivery information. CompassU also generates downloadable assessment reports and sends assessment results by email.

Institutional analytics should be aggregate by default, institution-scoped server-side, omit names/emails from standard aggregate reports, and suppress small cells below five students.

## Legal implementation principles

- FERPA: where an institution relies on the school-official exception, CompassU performs the contracted institutional service, remains subject to institutional direct-control provisions governing use and maintenance of education records, limits use to authorized purposes, and restricts redisclosure.
- COPPA: CompassU is designed primarily for high-school juniors/seniors and college freshmen. If an under-13 school-sponsored deployment is authorized, information must be limited to the school-authorized educational purpose. School authorization cannot be used to support unrelated commercial use.
- Requests: rights of institutions, parents, eligible students, or other authorized parties are handled through an authenticated request process. CompassU Master Administrators remain the technical operators who execute approved access/export/correction/deletion actions.
- Data minimization: collect and retain only data reasonably needed for the service, security, support, legal obligations, and authorized institutional reporting.
- De-identification: aggregated/de-identified information must not reasonably identify a student; small-cell suppression is a baseline safeguard, not the only safeguard.

## Launch status

These materials are implementation-ready drafts, not a substitute for legal advice. They should receive counsel review before broad commercial deployment and may need institution/state-specific addenda.