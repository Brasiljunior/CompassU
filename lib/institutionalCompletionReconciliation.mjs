import { enqueueCompletedInstitutionalAssessment } from './institutionalCompletionBridge.mjs';

/**
 * Server-only reconciliation of a trusted, preselected set of completed
 * assessment IDs. Intended for a future authenticated scheduled job.
 * Never accepts tenant or recipient details from the browser.
 * No emails are sent here; the outbox is independently processed.
 */
export async function reconcileInstitutionalCompletions({ db, attemptIds, maxBatch = 50, dryRun = true }) {
  if (!db || !Array.isArray(attemptIds) || !Number.isInteger(maxBatch) || maxBatch < 1 || maxBatch > 100 || typeof dryRun !== 'boolean') {
    throw new Error('Invalid trusted reconciliation context');
  }
  if (attemptIds.length > maxBatch) throw new Error('Reconciliation batch exceeds limit');
  const ids = [...new Set(attemptIds)];
  if (ids.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('Invalid assessment identifier in reconciliation batch');
  }
  // Default to a no-write preview until an authenticated operator explicitly
  // opts in after staging authorization and schema checks.
  if (dryRun) return {
    processed: 0,
    plannedOrExistingJobs: 0,
    dryRun: true,
    candidateCount: ids.length,
    results: [],
  };
  const results = [];
  for (const attemptId of ids) {
    try {
      const result = await enqueueCompletedInstitutionalAssessment({ db, attemptId });
      results.push({ attemptId, queued: result.queued, reason: result.reason });
    } catch (error) {
      // Fail individual items without skipping subsequent attempts. Do not
      // include database errors or student data in the returned summary.
      results.push({ attemptId, queued: 0, reason: 'processing_error' });
    }
  }
  return {
    processed: results.length,
    dryRun: false,
    // Outbox upsert uses ignoreDuplicates; this counts planned jobs, not
    // confirmed newly inserted rows or emails sent.
    plannedOrExistingJobs: results.reduce((total, result) => total + result.queued, 0),
    results,
  };
}
