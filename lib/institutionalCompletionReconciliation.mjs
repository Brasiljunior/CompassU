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
  // Direct callers must not bypass the batch-level write gate. Trusted
  // affiliation capture, authorization and staging validation are pending.
  throw new Error('Institutional reconciliation writes are not enabled');

}
