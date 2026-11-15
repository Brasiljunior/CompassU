import { buildInstitutionalFullReportEmail } from './institutionalFullReportEmail.mjs';
import { resolveConfiguredAssessmentRecipients } from './institutionalConfiguredRecipientResolver.mjs';

/**
 * Trusted preflight for the automatic institutional delivery path.
 * No student opt-in UI is involved. The institution must have an independently
 * verified disclosure authorization/contract before any student data is sent.
 * All inputs must be loaded by a privileged server, never from browser JSON.
 */
export function prepareAutomaticInstitutionalDelivery({
  attempt, accountEmail, assignments, recipients, institutionAuthorization,
  report, studentName,
}) {
  const route = resolveConfiguredAssessmentRecipients({
    attempt, accountEmail, assignments, recipients,
  });
  if (!route.eligible) return { ready: false, reason: route.reason };
  if (route.recipientEmails.length !== 1) {
    return { ready: false, reason: 'multiple_institutional_recipients_require_resolution' };
  }
  if (!institutionAuthorization ||
      institutionAuthorization.institution_name?.trim().toLowerCase() !== route.institutionName.toLowerCase() ||
      institutionAuthorization.approved !== true ||
      !institutionAuthorization.approved_at ||
      !Number.isFinite(Date.parse(institutionAuthorization.approved_at)) ||
      !Number.isFinite(Date.parse(attempt.completed_at)) ||
      Date.parse(institutionAuthorization.approved_at) > Date.parse(attempt.completed_at) ||
      institutionAuthorization.revoked_at ||
      !institutionAuthorization.authorization_reference?.trim()) {
    return { ready: false, reason: 'institutional_disclosure_authorization_missing' };
  }
  if (!report || report.attempt_id !== attempt.id ||
      report.student_user_id !== attempt.user_id ||
      !Number.isFinite(Date.parse(report.completed_at)) ||
      !Number.isFinite(Date.parse(attempt.completed_at)) ||
      Date.parse(report.completed_at) !== Date.parse(attempt.completed_at) ||
      report.institution_name?.trim().toLowerCase() !== route.institutionName.toLowerCase()) {
    return { ready: false, reason: 'verified_complete_report_missing' };
  }
  let email;
  try {
    email = buildInstitutionalFullReportEmail({
      studentName,
      institutionName: route.institutionName,
      completedAt: attempt.completed_at,
      sections: report.sections,
    });
  } catch {
    // Never attempt institutional disclosure with a partial or malformed report.
    return { ready: false, reason: 'verified_complete_report_missing' };
  }
  return {
    ready: true,
    recipientEmails: route.recipientEmails,
    subject: email.subject,
    text: email.text,
    attemptId: attempt.id,
  };
}
