import { planInstitutionalDelivery } from './institutionalAssessmentDelivery.mjs';

/**
 * Trusted server-only outbox writer. Never call from a browser.
 * Caller must authenticate a service job and resolve attempt/user/institution
 * from the database; never accept those values from request JSON.
 *
 * This does NOT send email. The outbox worker and secure report viewer
 * must be deployed and verified before enabling any institution.
 */
export async function enqueueInstitutionalAssessmentDelivery({
  db, attemptId, studentTenantId, consentApproved = false,
}) {
  if (!db || !attemptId || !studentTenantId) throw new Error('Missing trusted delivery context');

  const { data: attempt, error: attemptError } = await db
    .from('assessment_attempts')
    .select('id,user_id,status,completed_at')
    .eq('id', attemptId)
    .maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt || attempt.status !== 'completed' || !attempt.completed_at) {
    return { queued: 0, reason: 'assessment_not_completed' };
  }

  // Verify membership using the attempt owner, not a user-supplied identity.
  const { data: membership, error: membershipError } = await db
    .from('institution_memberships')
    .select('tenant_institution_id,active')
    .eq('user_id', attempt.user_id)
    .eq('tenant_institution_id', studentTenantId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return { queued: 0, reason: 'institution_mismatch' };

  const { data: settings, error: settingsError } = await db
    .from('institution_assessment_delivery_settings')
    .select('tenant_institution_id,enabled,report_mode,authorization_reference')
    .eq('tenant_institution_id', studentTenantId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.enabled) return { queued: 0, reason: 'disabled' };

  const { data: recipients, error: recipientError } = await db
    .from('institution_assessment_recipients')
    .select('id,tenant_institution_id,email,active,verified_at')
    .eq('tenant_institution_id', studentTenantId)
    .eq('active', true);
  if (recipientError) throw recipientError;

  const jobs = planInstitutionalDelivery({
    settings, recipients: recipients ?? [], attempt, studentTenantId, consentApproved,
  });
  if (!jobs.length) return { queued: 0, reason: 'not_authorized_or_no_verified_recipients' };

  // Database unique constraint enforces idempotency on retries.
  const { error: queueError } = await db
    .from('institution_assessment_delivery_jobs')
    .upsert(jobs, { onConflict: 'attempt_id,tenant_institution_id,recipient_id,report_type', ignoreDuplicates: true });
  if (queueError) throw queueError;
  return { queued: jobs.length, reason: 'queued_or_already_exists' };
}
