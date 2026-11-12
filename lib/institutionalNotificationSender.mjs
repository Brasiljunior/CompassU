import { institutionalReportNotification } from './institutionalReportNotification.mjs';
import { canDispatchInstitutionalNotification } from './institutionalDispatchPolicy.mjs';
import { normalizeInstitutionalEmail } from './institutionalAssessmentDelivery.mjs';

/**
 * One-job server-side notification sender. The caller must atomically claim
 * the job and freshly load all authorization records before invoking this.
 * Never call from client code. Does not mutate the database or claim jobs.
 */
export async function sendInstitutionalNotification({
  job, attempt, recipient, membership, studentMembership, authorization, settings,
  institutionName, portalUrl, allowedPortalOrigins,
  sendEmail, fromAddress,
}) {
  if (!canDispatchInstitutionalNotification({ job, attempt, recipient, membership, studentMembership, authorization, settings })) {
    return { status: 'skipped', reason: 'authorization_denied' };
  }
  if (typeof sendEmail !== 'function' || !fromAddress) {
    throw new Error('Institutional email transport is not configured');
  }
  const email = normalizeInstitutionalEmail(recipient.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'skipped', reason: 'invalid_recipient_email' };
  }
  const notification = institutionalReportNotification({
    institutionName, reportType: job.report_type, portalUrl, allowedPortalOrigins,
  });
  const result = await sendEmail({
    from: fromAddress,
    to: [email],
    subject: notification.subject,
    text: notification.text,
    // Stable idempotency key must be forwarded to the provider by the adapter.
    idempotencyKey: 'institutional-delivery/' + job.id,
  });
  if (!result || typeof result.id !== 'string' || !result.id.trim()) {
    throw new Error('Email provider did not confirm message acceptance');
  }
  return { status: 'sent', provider_message_id: result.id };
}
