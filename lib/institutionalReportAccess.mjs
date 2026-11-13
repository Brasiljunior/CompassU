/**
 * Server-only report access policy. A successful login alone never grants
 * access: the viewer must belong to the same institution and be an active,
 * verified, explicitly designated report recipient.
 */
export function canViewInstitutionalAssessmentReport({
  authenticatedUserId,
  viewerMembership,
  designatedRecipient,
  deliverySettings,
  authorization,
  report,
}) {
  if (!authenticatedUserId || !viewerMembership || !designatedRecipient || !deliverySettings || !authorization || !report) return false;
  if (viewerMembership.user_id !== authenticatedUserId || viewerMembership.active !== true) return false;
  if (designatedRecipient.user_id !== authenticatedUserId || designatedRecipient.active !== true || !designatedRecipient.verified_at) return false;
  const institutionId = viewerMembership.tenant_institution_id;
  if (!institutionId || designatedRecipient.tenant_institution_id !== institutionId) return false;
  if (deliverySettings.tenant_institution_id !== institutionId || deliverySettings.enabled !== true) return false;
  if (typeof deliverySettings.authorization_reference !== 'string' || !deliverySettings.authorization_reference.trim()) return false;
  if (report.tenant_institution_id !== institutionId || report.status !== 'sent') return false;
  if (!report.attempt_id || authorization.attempt_id !== report.attempt_id || authorization.tenant_institution_id !== institutionId) return false;
  if (authorization.approved !== true || !authorization.approved_at || authorization.revoked_at || !authorization.authorization_reference?.trim()) return false;
  if (report.recipient_id !== designatedRecipient.id) return false;
  if (report.report_type !== 'summary' || deliverySettings.report_mode !== 'summary') return false;
  return true;
}
