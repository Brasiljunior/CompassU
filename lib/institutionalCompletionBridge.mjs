import { enqueueInstitutionalAssessmentDelivery } from './institutionalAssessmentOutbox.mjs';
import { resolveInstitutionalAssessmentAffiliation } from './institutionalAssessmentAffiliation.mjs';

/** Server-only completion bridge. Never infer student tenant from staff roles. */
export async function enqueueCompletedInstitutionalAssessment({ db, attemptId }) {
  if (!db || typeof attemptId !== 'string' || !attemptId.trim()) {
    throw new Error('Missing or invalid trusted completion context');
  }
  const { data: attempt, error: attemptError } = await db.from('assessment_attempts')
    .select('id,user_id,status,completed_at').eq('id', attemptId).maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt || attempt.status !== 'completed' || !attempt.completed_at || !attempt.user_id) {
    return { queued: 0, reason: 'assessment_not_completed' };
  }
  const affiliation = await resolveInstitutionalAssessmentAffiliation({ db, attemptId });
  if (!affiliation.verified) return { queued: 0, reason: affiliation.reason };
  return enqueueInstitutionalAssessmentDelivery({
    db, attemptId, studentTenantId: affiliation.tenantInstitutionId,
  });
}
