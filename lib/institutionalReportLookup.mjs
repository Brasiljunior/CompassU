import { canViewInstitutionalAssessmentReport } from './institutionalReportAccess.mjs';

/**
 * Server-only report authorization lookup.
 * Caller must authenticate the viewer using Supabase Auth on the server;
 * never accept a user ID from a browser request body.
 * Returns authorization metadata only, never assessment results.
 */
export async function authorizeInstitutionalReportView({ db, authenticatedUserId, jobId }) {
  if (!db || !authenticatedUserId || !jobId) return { allowed: false, reason: 'missing_context' };
  async function one(table, fields, key, value) {
    const { data, error } = await db.from(table).select(fields).eq(key, value).maybeSingle();
    if (error) throw error;
    return data;
  }
  const job = await one('institution_assessment_delivery_jobs',
    'id,attempt_id,tenant_institution_id,recipient_id,report_type,status', 'id', jobId);
  if (!job || job.status !== 'sent') return { allowed: false, reason: 'report_unavailable' };
  // Resolve the designated recipient first; do not read assessment authorization
  // or owner information for a viewer who is not the named recipient.
  const recipient = await one('institution_assessment_recipients',
    'id,user_id,tenant_institution_id,active,verified_at', 'id', job.recipient_id);
  if (!recipient || recipient.user_id !== authenticatedUserId || recipient.active !== true || !recipient.verified_at || recipient.tenant_institution_id !== job.tenant_institution_id) {
    return { allowed: false, reason: 'access_denied' };
  }
  const { data: membership, error: membershipError } = await db.from('institution_memberships')
    .select('user_id,tenant_institution_id,active')
    .eq('user_id', authenticatedUserId)
    .eq('tenant_institution_id', job.tenant_institution_id)
    .eq('active', true).limit(1).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return { allowed: false, reason: 'access_denied' };
  const [settings, authorization] = await Promise.all([
    one('institution_assessment_delivery_settings',
      'tenant_institution_id,enabled,report_mode,authorization_reference', 'tenant_institution_id', job.tenant_institution_id),
    one('institution_assessment_authorizations',
      'attempt_id,tenant_institution_id,approved,approved_at,revoked_at,authorization_reference', 'attempt_id', job.attempt_id),
  ]);
  // Recheck the assessment owner's active membership before exposing metadata.
  const attempt = await one('assessment_attempts', 'id,user_id,status,completed_at', 'id', job.attempt_id);
  if (!attempt || attempt.status !== 'completed' || !attempt.completed_at || !attempt.user_id) {
    return { allowed: false, reason: 'access_denied' };
  }
  const { data: studentMembership, error: studentMembershipError } = await db.from('institution_memberships')
    .select('user_id,tenant_institution_id,active')
    .eq('user_id', attempt.user_id)
    .eq('tenant_institution_id', job.tenant_institution_id)
    .eq('active', true).limit(1).maybeSingle();
  if (studentMembershipError) throw studentMembershipError;
  if (!studentMembership) return { allowed: false, reason: 'access_denied' };
  // Recheck authorization immediately before returning a report access decision.
  const allowed = canViewInstitutionalAssessmentReport({
    authenticatedUserId, viewerMembership: membership, designatedRecipient: recipient,
    deliverySettings: settings, authorization, report: job,
  });
  return allowed
    ? { allowed: true, jobId: job.id, attemptId: job.attempt_id, reportType: job.report_type }
    : { allowed: false, reason: 'access_denied' };
}
