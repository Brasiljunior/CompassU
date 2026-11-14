import { resolveVerifiedStudentAssignment } from './institutionalStudentAssignment.mjs';
import { resolveInstitutionalAssessmentAffiliation } from './institutionalAssessmentAffiliation.mjs';

/**
 * Read-only Phase 2 reconciliation check for a completed assessment.
 * This never creates a snapshot, authorization, job, or notification.
 * Historical completions without trusted snapshots remain ineligible.
 */
export async function inspectInstitutionalCompletionReadiness({ db, attemptId }) {
  if (!db || typeof attemptId !== 'string' || !attemptId.trim()) {
    throw new Error('Missing trusted completion inspection context');
  }
  const { data: attempt, error } = await db.from('assessment_attempts')
    .select('id,user_id,status,completed_at')
    .eq('id', attemptId).maybeSingle();
  if (error) throw error;
  if (!attempt || attempt.id !== attemptId || !attempt.user_id ||
      attempt.status !== 'completed' || !attempt.completed_at) {
    return { ready: false, reason: 'assessment_not_completed' };
  }

  const assignment = await resolveVerifiedStudentAssignment({ db, userId: attempt.user_id });
  if (!assignment.verified) return { ready: false, reason: assignment.reason };
  // An assignment verified after completion cannot establish the institution
  // at the time the student completed the assessment.
  const completedAt = Date.parse(attempt.completed_at);
  if (!Number.isFinite(completedAt) ||
      Date.parse(assignment.verifiedAt) > completedAt) {
    return { ready: false, reason: 'assignment_not_verified_at_completion' };
  }

  const snapshot = await resolveInstitutionalAssessmentAffiliation({ db, attemptId });
  if (!snapshot.verified) return { ready: false, reason: snapshot.reason };
  if (snapshot.tenantInstitutionId !== assignment.tenantInstitutionId) {
    return { ready: false, reason: 'assignment_snapshot_mismatch' };
  }
  if (snapshot.evidenceReference !== assignment.evidenceReference) {
    return { ready: false, reason: 'assignment_snapshot_evidence_mismatch' };
  }
  return { ready: true, reason: 'verified_assignment_and_snapshot_match' };
}
