import { findInstitutionalCompletionCandidates } from './institutionalCompletionDiscovery.mjs';
import { reconcileInstitutionalCompletions } from './institutionalCompletionReconciliation.mjs';

/**
 * Server-only orchestration of candidate discovery and reconciliation.
 * Defaults to no-write preview. No HTTP endpoint or scheduler is enabled.
 */
export async function runInstitutionalCompletionBatch({
  db, completedAfter, completedBefore, limit = 50, dryRun = true,
}) {
  if (typeof dryRun !== 'boolean') throw new Error('Invalid institutional batch mode');
  const attemptIds = await findInstitutionalCompletionCandidates({
    db, completedAfter, completedBefore, limit,
  });
  const result = await reconcileInstitutionalCompletions({
    db, attemptIds, maxBatch: limit, dryRun,
  });
  return {
    ...result,
    // A full batch may indicate undiscovered records. Do not report a
    // window as exhausted without keyset pagination.
    potentiallyMoreCandidates: attemptIds.length >= limit,
  };
}
