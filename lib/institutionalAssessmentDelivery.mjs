/**
 * Pure policy helpers for institutional assessment delivery.
 * These functions deliberately do not send email or expose report data.
 */
export const REPORT_MODES = Object.freeze(['full', 'summary', 'both']);

export function normalizeInstitutionalEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function reportTypesForMode(mode) {
  if (mode === 'both') return ['full', 'summary'];
  if (mode === 'full' || mode === 'summary') return [mode];
  return [];
}

export function isInstitutionalDeliveryEligible({ settings, recipient, attempt, studentTenantId, consentApproved }) {
  if (!settings || settings.enabled !== true) return false;
  if (!settings.authorization_reference?.trim() || consentApproved !== true) return false;
  if (!reportTypesForMode(settings.report_mode).length) return false;
  if (!attempt || attempt.status !== 'completed' || !attempt.completed_at) return false;
  if (!studentTenantId || settings.tenant_institution_id !== studentTenantId) return false;
  if (!recipient || recipient.tenant_institution_id !== studentTenantId) return false;
  if (recipient.active !== true || !recipient.verified_at) return false;
  const email = normalizeInstitutionalEmail(recipient.email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function planInstitutionalDelivery({ settings, recipients = [], attempt, studentTenantId, consentApproved }) {
  const types = reportTypesForMode(settings?.report_mode);
  const seen = new Set();
  const jobs = [];
  for (const recipient of recipients) {
    if (!isInstitutionalDeliveryEligible({ settings, recipient, attempt, studentTenantId, consentApproved })) continue;
    const email = normalizeInstitutionalEmail(recipient.email);
    for (const reportType of types) {
      const key = [attempt.id, studentTenantId, email, reportType].join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push({ attempt_id: attempt.id, tenant_institution_id: studentTenantId, recipient_id: recipient.id, report_type: reportType });
    }
  }
  return jobs;
}
