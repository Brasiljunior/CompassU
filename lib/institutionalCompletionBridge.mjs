import { enqueueInstitutionalAssessmentDelivery } from './institutionalAssessmentOutbox.mjs';

/**
 * Server-only completion bridge. Caller must use a trusted service-role client
 * and a verified completed assessment identifier, never a browser-supplied tenant.
 * Does not send notifications; only stages idempotent outbox jobs.
 */
export async function enqueueCompletedInstitutionalAssessment({ db, attemptId }) {
  if (!db || !attemptId) throw new Error('Missing trusted completion context');
  const { data: attempt, error: attemptError } = await db.from('assessment_attempts')
    .select('id,user_id,status,completed_at').eq('id', attemptId).maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt || attempt.status !== 'completed' || !attempt.completed_at || !attempt.user_id) {
    return { queued: 0, reason: 'assessment_not_completed' };
  }
  const { data: memberships, error: membershipError } = await db.from('institution_memberships')
    .select('tenant_institution_id').eq('user_id', attempt.user_id).eq('active', true);
  if (membershipError) throw membershipError;
  // Inspect the entire active membership set: limiting to two rows can hide
  // another institution if the first two rows belong to the same tenant.
  const tenantIds = [...new Set((memberships ?? []).map(row => row.tenant_institution_id).filter(Boolean))];
  // Never guess which institution receives results when the owner has multiple homes.
  if (tenantIds.length !== 1) {
    return { queued: 0, reason: tenantIds.length ? 'ambiguous_institution' : 'no_institution' };
  }
  return enqueueInstitutionalAssessmentDelivery({ db, attemptId, studentTenantId: tenantIds[0] });
}
