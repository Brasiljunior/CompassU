import { canViewInstitutionalAssessmentReport } from './institutionalReportAccess.mjs';

/**
 * Recheck authorization immediately before sending a notification.
 * Delivery workers must not trust eligibility at the time a job was queued.
 * The caller supplies records freshly loaded from the database.
 */
export function canDispatchInstitutionalNotification({
  job, attempt, recipient, membership, settings,
}) {
  if (!job || !attempt || !recipient || !membership || !settings) return false;
  if (job.status !== 'processing' || !job.id || !job.attempt_id) return false;
  if (attempt.id !== job.attempt_id || attempt.status !== 'completed' || !attempt.completed_at) return false;
  if (recipient.id !== job.recipient_id || !recipient.user_id) return false;
  if (membership.user_id !== recipient.user_id) return false;
  // Access policy requires 'sent'; for dispatch, validate against a synthetic
  // sent-state report with the same tenant, recipient, and report type.
  return canViewInstitutionalAssessmentReport({
    authenticatedUserId: recipient.user_id,
    viewerMembership: membership,
    designatedRecipient: recipient,
    deliverySettings: settings,
    report: {
      tenant_institution_id: job.tenant_institution_id,
      recipient_id: job.recipient_id,
      report_type: job.report_type,
      status: 'sent',
    },
  });
}
