import { buildInstitutionalFullReportEmail } from './institutionalFullReportEmail.mjs';
import { normalizeInstitutionalEmail } from './institutionalAssessmentDelivery.mjs';

/**
 * Isolated full-report delivery adapter, NOT connected to production.
 * Authorization must be rechecked immediately before the send.
 * In particular, never fall back to a summary when a complete report
 * is missing. Exactly one verified institutional recipient is allowed.
 */
export async function sendInstitutionalFullReport({
  authorized, recipient, attempt, institutionName, studentName, sections,
  fromAddress, sendEmail, dryRun = true,
}) {
  if (authorized !== true || recipient?.active !== true || !recipient?.verified_at ||
      recipient?.tenant_institution_id !== attempt?.tenant_institution_id ||
      attempt?.status !== 'completed' || !attempt?.completed_at || !attempt?.id) {
    return { status: 'skipped', reason: 'authorization_denied' };
  }
  const email = normalizeInstitutionalEmail(recipient.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'skipped', reason: 'invalid_recipient_email' };
  }
  const message = buildInstitutionalFullReportEmail({
    studentName, institutionName, completedAt: attempt.completed_at, sections,
  });
  if (dryRun) return { status: 'preview', subject: message.subject, text: message.text };
  if (typeof sendEmail !== 'function' || !fromAddress) {
    throw new Error('Institutional email transport is not configured');
  }
  const result = await sendEmail({
    from: fromAddress, to: [email], subject: message.subject, text: message.text,
    idempotencyKey: 'institutional-full-report/' + attempt.id + '/' + recipient.id,
  });
  if (typeof result?.id !== 'string' || !result.id.trim()) {
    throw new Error('Email provider did not confirm message acceptance');
  }
  return { status: 'sent', provider_message_id: result.id };
}
