/**
 * Read-only resolution of a trusted per-assessment affiliation snapshot.
 * No fallback to staff memberships, mutable email, or browser-provided tenant.
 */
export async function resolveInstitutionalAssessmentAffiliation({ db, attemptId }) {
  if (!db || typeof attemptId !== 'string' || !attemptId.trim()) {
    throw new Error('Missing trusted assessment affiliation context');
  }
  const { data: affiliation, error } = await db
    .from('institution_assessment_affiliations')
    .select('attempt_id,tenant_institution_id,evidence_reference')
    .eq('attempt_id', attemptId)
    .maybeSingle();
  if (error) throw error;
  if (affiliation?.attempt_id !== attemptId ||
      typeof affiliation.tenant_institution_id !== 'string' ||
      !affiliation.tenant_institution_id.trim() ||
      typeof affiliation.evidence_reference !== 'string' ||
      !affiliation.evidence_reference.trim()) {
    return { verified: false, reason: 'student_affiliation_not_verified' };
  }
  return { verified: true, tenantInstitutionId: affiliation.tenant_institution_id };
}
