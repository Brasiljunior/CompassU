import { captureCompletedAssessmentAffiliation } from './institutionalCompletionSnapshotCapture.mjs';
import { persistInstitutionalFullReportSnapshot } from './institutionalSnapshotWriter.mjs';
import { enqueueCompletedInstitutionalAssessment } from './institutionalCompletionBridge.mjs';

/**
 * Server-only integration point for an independently authenticated, trusted
 * assessment finalization callback. No browser-supplied report is accepted.
 * The caller must supply a service-role DB client and server-side report generator.
 * Does not expose a route, scheduler, or automatically activate delivery.
 */
export async function finalizeInstitutionalAssessmentDelivery({
  db, attemptId, completedUserId, generateReport,
}) {
  if (!db?.from || !attemptId || !completedUserId ||
      typeof generateReport !== 'function') {
    throw new Error('Trusted institutional finalization context required');
  }
  const capture = await captureCompletedAssessmentAffiliation({
    db, attemptId, completedUserId,
  });
  if (!capture.captured) {
    return { queued: 0, stage: 'affiliation', reason: capture.reason };
  }
  await persistInstitutionalFullReportSnapshot({ db, attemptId, generateReport });
  const outcome = await enqueueCompletedInstitutionalAssessment({ db, attemptId });
  return { ...outcome, stage: 'outbox' };
}
