/**
 * Server-only validation of verified institutional student assignment.
 * A mutable email lookup, client-supplied tenant, or staff membership must
 * never be used as an alternate source.
 * This does not capture an attempt snapshot or authorize report delivery.
 */
export async function resolveVerifiedStudentAssignment({ db, userId }) {
  if (!db || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Missing trusted student assignment context');
  }
  const { data, error } = await db.from('institution_student_assignments')
    .select('user_id,tenant_institution_id,evidence_reference,verified_at')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data?.user_id !== userId ||
      typeof data.tenant_institution_id !== 'string' ||
      !data.tenant_institution_id.trim() ||
      typeof data.evidence_reference !== 'string' ||
      !data.evidence_reference.trim() ||
      typeof data.verified_at !== 'string' ||
      !Number.isFinite(Date.parse(data.verified_at)) ||
      Date.parse(data.verified_at) > Date.now()) {
    return { verified: false, reason: 'student_assignment_not_verified' };
  }
  return {
    verified: true,
    tenantInstitutionId: data.tenant_institution_id,
    evidenceReference: data.evidence_reference,
  };
}
