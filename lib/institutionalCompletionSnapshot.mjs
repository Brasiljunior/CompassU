import { persistInstitutionalFullReportSnapshot } from './institutionalSnapshotWriter.mjs';

/** Server-side hook invoked after finalize_assessment commits.
 * Requires a trusted generator that reproduces the student's complete results.
 * Does not send email and must never receive report sections from the browser.
 */
export async function captureCompletedAssessmentForInstitution({db,attemptId,generateReport}) {
  if (!db?.from || !attemptId || typeof generateReport !== 'function')
    throw new Error('Completion snapshot requires privileged database and trusted generator');
  return persistInstitutionalFullReportSnapshot({db,attemptId,generateReport});
}
