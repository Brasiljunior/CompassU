import { planInstitutionalDelivery } from './institutionalAssessmentDelivery.mjs';

/**
 * Trusted server-only outbox writer. Never call from a browser.
 * Caller must authenticate a service job and resolve attempt/user/institution
 * from the database; never accept those values from request JSON.
 * Per-assessment authorization is loaded directly from the database.
 *
 * This does NOT send email. The outbox worker and secure report viewer
 * must be deployed and verified before enabling any institution.
 */
export async function enqueueInstitutionalAssessmentDelivery({
  db, attemptId, studentTenantId,
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

  // Authorization must be read from trusted database state, never caller input.
  const { data: authorization, error: authorizationError } = await db
    .from('institution_assessment_authorizations')
    .select('attempt_id,tenant_institution_id,approved,approved_at,revoked_at,authorization_reference')
    .eq('attempt_id', attemptId)
    .maybeSingle();
  if (authorizationError) throw authorizationError;
  const consentApproved = authorization?.attempt_id === attemptId
    && authorization.tenant_institution_id === studentTenantId
    && authorization.approved === true
    && Boolean(authorization.approved_at)
    && !authorization.revoked_at
    && typeof authorization.authorization_reference === 'string'
    && Boolean(authorization.authorization_reference.trim());
  if (!consentApproved) return { queued: 0, reason: 'authorization_not_confirmed' };

  const { data: settings, error: settingsError } = await db
    .from('institution_assessment_delivery_settings')
    .select('tenant_institution_id,enabled,report_mode,authorization_reference')
    .eq('tenant_institution_id', studentTenantId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings?.enabled) return { queued: 0, reason: 'disabled' };

  const { data: recipients, error: recipientError } = await db
    .from('institution_assessment_recipients')
    .select('id,user_id,tenant_institution_id,email,active,verified_at')
    .eq('tenant_institution_id', studentTenantId)
    .eq('active', true);
  if (recipientError) throw recipientError;

  // A designated recipient must also have an active membership in this institution.
  const eligibleRecipients = [];
  for (const recipient of recipients ?? []) {
    const { data: recipientMembership, error: recipientMembershipError } = await db
      .from('institution_memberships')
      .select('id')
      .eq('user_id', recipient.user_id)
      .eq('tenant_institution_id', studentTenantId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (recipientMembershipError) throw recipientMembershipError;
    if (recipientMembership) eligibleRecipients.push(recipient);
  }

  const jobs = planInstitutionalDelivery({
    settings, recipients: eligibleRecipients, attempt, studentTenantId, consentApproved,
  });
  if (!jobs.length) return { queued: 0, reason: 'not_authorized_or_no_verified_recipients' };

  // Database unique constraint enforces idempotency on retries.
  const { error: queueError } = await db
    .from('institution_assessment_delivery_jobs')
    .upsert(jobs, { onConflict: 'attempt_id,tenant_institution_id,recipient_id,report_type', ignoreDuplicates: true });
  if (queueError) throw queueError;
  return { queued: jobs.length, reason: 'queued_or_already_exists' };
}
