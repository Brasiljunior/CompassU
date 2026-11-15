/**
 * Trusted report-data boundary for institutional full-report delivery.
 * This module deliberately does not reconstruct a student's report from
 * incomplete major-match rows: all sections must come from the same
 * authorized, completed assessment report that the student sees.
 *
 * loadCompletedStudentReport is a server-only, trusted loader supplied by
 * the integration. It must never trust browser-supplied report sections.
 */
import { buildInstitutionalFullReportEmail } from './institutionalFullReportEmail.mjs';

export async function loadInstitutionalFullReport({
  attempt, loadCompletedStudentReport,
}) {
  if (!attempt?.id || !attempt.user_id || attempt.status !== 'completed' ||
      !attempt.completed_at) {
    throw new Error('A completed assessment is required');
  }
  if (typeof loadCompletedStudentReport !== 'function') {
    throw new Error('Trusted student report loader is not configured');
  }
  const report = await loadCompletedStudentReport({
    attemptId: attempt.id, studentUserId: attempt.user_id,
  });
  if (!report || report.attemptId !== attempt.id ||
      report.studentUserId !== attempt.user_id ||
      report.completedAt !== attempt.completed_at) {
    throw new Error('Completed student report does not match the assessment');
  }
  // Some verified legacy home-institution assignments have no tenant UUID.
  // The trusted integration must resolve the institution from account_institutions,
  // and the preflight independently checks the institution name and recipient.
  if (typeof report.institutionName !== 'string' ||
      !report.institutionName.trim()) {
    throw new Error('Missing verified home institution in student report');
  }
  // Validate all nine required sections before the report is returned.
  buildInstitutionalFullReportEmail({
    studentName: report.studentName,
    institutionName: report.institutionName,
    completedAt: report.completedAt,
    sections: report.sections,
  });
  return report;
}
