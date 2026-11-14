import { inspectInstitutionalCompletionReadiness } from './institutionalCompletionReadiness.mjs';

/**
 * Server-only Phase 2 readiness audit. Read-only, bounded, no delivery writes.
 * Returns aggregate reason counts, never student identifiers or report data.
 */
export async function auditInstitutionalCompletionReadiness({ db, attemptIds, maxBatch = 50 }) {
  if (!db || !Array.isArray(attemptIds) || !Number.isInteger(maxBatch) ||
      maxBatch < 1 || maxBatch > 100 || attemptIds.length > maxBatch ||
      attemptIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('Invalid trusted institutional readiness audit context');
  }
  const ids = [...new Set(attemptIds)];
  const reasons = Object.create(null);
  let ready = 0;
  for (const attemptId of ids) {
    const result = await inspectInstitutionalCompletionReadiness({ db, attemptId });
    if (result.ready) ready += 1;
    else reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
  }
  return { inspected: ids.length, ready, blocked: ids.length - ready, reasons: { ...reasons }, dryRun: true };
}
