# CompassU Data Retention & Deletion Standard

**Status:** Proposed production standard; counsel/operations approval required

CompassU uses purpose-based retention. Retention periods below are the proposed launch baseline and must be aligned with actual backup/log configurations before final publication.

| Data class | Proposed active retention | Disposition |
|---|---:|---|
| Active student account/profile | Duration of active account/institutional service | Delete/de-identify after validated termination/deletion workflow |
| Assessment responses/attempts and derived recommendations | Duration of active account plus up to 12 months after account/institution termination unless institution requires shorter period | Delete or irreversibly de-identify |
| User favorites/preferences | Duration of active account plus up to 12 months after termination | Delete |
| Institution assignment/membership | Duration of institutional relationship plus up to 12 months | Delete/de-identify where no longer operationally required |
| Invitation/batch delivery records | Up to 12 months | Delete/de-identify unless needed for dispute/security evidence |
| Institutional report delivery records | Up to 24 months | Delete/de-identify recipient information where no longer required |
| Administrative/security audit logs | Up to 24 months, or longer when reasonably necessary for security/legal investigation | Preserve necessary event history while removing direct user references on account deletion; securely delete after retention period |
| Security incident/legal-hold records | Duration of investigation/hold plus legally appropriate closure period | Controlled deletion after release |
| Aggregate/de-identified analytics | May be retained longer if reasonably de-identified and not reasonably linkable to an individual | Periodic re-identification-risk review |
| Backups | According to production backup lifecycle | Expire automatically; no restoration solely to recover deleted user data |

## Deletion workflow

1. Request received from an authorized source.
2. CompassU verifies identity, authority, institution and record scope.
3. Any applicable legal hold, security investigation or contractual retention requirement is checked.
4. Authorized CompassU Master Administrator executes the approved deletion/de-identification action.
5. Execution is recorded where appropriate without retaining unnecessary deleted content in the audit record.
6. Downstream systems/service providers are addressed where required and technically supported.
7. Backups containing historical copies remain protected and age out through the normal backup lifecycle; deleted data must not be intentionally restored into active use except when required for disaster recovery, in which case the deletion instruction must be re-applied where feasible.

## Verified account deletion behavior

The production database was reviewed on September 11, 2026. Deleting an authentication user currently cascades deletion of the user's profile, assessment attempts, assessment responses, major-match records, institution/organization memberships, favorites, and other user-owned records that are configured as dependent data.

Historical administrative records that must remain for security, accountability, or operational history are configured differently. References to the deleted user in administrative audit logs, administrator invitations, batch invitation reports, and creator fields on institution/organization memberships are set to `NULL` rather than blocking deletion or deleting the historical event itself. Audit-log target-user references are also set to `NULL` when the referenced user is deleted. This preserves the event record while removing the direct Auth-user relationship.

Existing orphaned audit target identifiers identified during the September 11, 2026 review were de-identified, and the database now enforces `ON DELETE SET NULL` behavior for those target references going forward.

## Account deletion effects

Deletion covers, as applicable, authentication identity, profile information, institution assignment/membership, assessment attempts/responses, recommendation records, favorites and other directly user-linked application records. Historical audit/operational records may be retained for their approved retention period after direct user references have been removed as described above.

## Institutional termination

At institutional termination, CompassU and the institution should identify accounts/data within the institution's scope, any required export, the deletion/de-identification instruction, and the applicable transition period. Institutions do not directly execute database deletion; CompassU Master Administrators execute validated instructions.

## Review

Retention periods must be reviewed at least annually and whenever product functionality, law, contractual requirements, backup architecture or subprocessors materially change.