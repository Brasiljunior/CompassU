/**
 * Server-only adapter for immutable completed-assessment snapshots.
 * Must be called with a privileged DB client only after recipient authorization.
 * Snapshot writing belongs in trusted finalization and is not implemented here.
 */
export function createCompletedStudentReportLoader({db}) {
  if (!db || typeof db.from !== 'function') {
    throw new Error('Trusted snapshot database is required');
  }
  return async function loadCompletedStudentReport({attemptId,studentUserId}) {
    if (!attemptId || !studentUserId) throw new Error('Assessment identity is required');
    const {data,error}=await db.from('institution_assessment_full_report_snapshots')
      .select('attempt_id,student_user_id,tenant_institution_id,completed_at,student_name,institution_name,sections')
      .eq('attempt_id',attemptId)
      .eq('student_user_id',studentUserId)
      .maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Completed student report snapshot is unavailable');
    return {
      attemptId:data.attempt_id,
      studentUserId:data.student_user_id,
      tenantInstitutionId:data.tenant_institution_id,
      completedAt:data.completed_at,
      studentName:data.student_name,
      institutionName:data.institution_name,
      sections:data.sections,
    };
  };
}
