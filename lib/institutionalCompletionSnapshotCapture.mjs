import { resolveVerifiedStudentAssignment } from './institutionalStudentAssignment.mjs';

/**
 * Privileged server-only capture for a newly completed assessment.
 * Caller must independently verify the completion event and use a service-role
 * database client. This is not a browser endpoint or a historical backfill.
 * It does not authorize delivery or send a notification.
 */
export async function captureCompletedAssessmentAffiliation({ db, attemptId, completedUserId }) {
  if (!db || typeof attemptId !== 'string' || !attemptId.trim() ||
      typeof completedUserId !== 'string' || !completedUserId.trim()) {
    throw new Error('Missing trusted assessment completion context');
  }
  const { data: attempt, error } = await db.from('assessment_attempts')
    .select('id,user_id,status,completed_at').eq('id', attemptId).maybeSingle();
  if (error) throw error;
  if (!attempt || attempt.id !== attemptId || attempt.user_id !== completedUserId ||
      attempt.status !== 'completed' || !Number.isFinite(Date.parse(attempt.completed_at))) {
    return { captured: false, reason: 'assessment_not_completed_or_owner_mismatch' };
  }
  const assignment = await resolveVerifiedStudentAssignment({ db, userId: completedUserId });
  if (!assignment.verified) return { captured: false, reason: assignment.reason };
  if (Date.parse(assignment.verifiedAt) > Date.parse(attempt.completed_at)) {
    return { captured: false, reason: 'assignment_not_verified_at_completion' };
  }
  const { data: existing, error: lookupError } = await db.from('institution_assessment_affiliations')
    .select('attempt_id,tenant_institution_id,evidence_reference')
    .eq('attempt_id', attemptId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    return existing.attempt_id === attemptId &&
      existing.tenant_institution_id === assignment.tenantInstitutionId &&
      existing.evidence_reference === assignment.evidenceReference
      ? { captured: true, reason: 'already_captured' }
      : { captured: false, reason: 'immutable_snapshot_conflict' };
  }
  // This write must occur only inside a trusted completion workflow.
  // A uniqueness conflict is intentionally not overwritten or retried as an update.
  const { error: insertError } = await db.from('institution_assessment_affiliations').insert({
    attempt_id: attemptId,
    tenant_institution_id: assignment.tenantInstitutionId,
    evidence_reference: assignment.evidenceReference,
  });
  if (insertError) {
    if (insertError.code === '23505') {
      return { captured: false, reason: 'snapshot_concurrent_conflict' };
    }
    throw insertError;
  }
  return { captured: true, reason: 'captured' };
}
