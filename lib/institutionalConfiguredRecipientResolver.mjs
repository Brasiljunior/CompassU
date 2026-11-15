/**
 * Resolve a student's institution and designated recipient from server-loaded
 * records. Never accept an institution or destination email from the browser.
 * This resolver does not authorize disclosure or send email.
 */
export function resolveConfiguredAssessmentRecipients({
  attempt, accountEmail, assignments, recipients,
}) {
  if (!attempt || attempt.status !== 'completed' || !attempt.completed_at ||
      !attempt.user_id || typeof accountEmail !== 'string') {
    return { eligible: false, reason: 'attempt_not_completed' };
  }
  const normalized = value => String(value || '').trim().toLowerCase();
  const matched = (assignments || []).filter(a =>
    normalized(a.email) === normalized(accountEmail) &&
    typeof a.institution === 'string' && a.institution.trim());
  const tenantIds = [...new Set(matched.map(a => a.tenant_institution_id).filter(Boolean).map(String))];
  if (tenantIds.length > 1) {
    return { eligible: false, reason: 'ambiguous_or_missing_home_institution' };
  }
  const names = [...new Set(matched.map(a => normalized(a.institution)))];
  if (names.length !== 1) {
    return { eligible: false, reason: 'ambiguous_institution_name' };
  }
  const destinations = [...new Set((recipients || [])
    .filter(r => r.active === true && normalized(r.institution) === names[0])
    .map(r => normalized(r.email))
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  if (!destinations.length) {
    return { eligible: false, reason: 'no_active_recipient' };
  }
  return {
    eligible: true,
    tenantInstitutionId: tenantIds[0] || null,
    institutionName: matched[0].institution.trim(),
    recipientEmails: destinations,
  };
}
