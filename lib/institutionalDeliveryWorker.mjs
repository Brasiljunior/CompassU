import { sendInstitutionalNotification } from './institutionalNotificationSender.mjs';
import { nextInstitutionalDeliveryRetry } from './institutionalDeliveryRetry.mjs';

/**
 * Process a job already atomically claimed by a trusted scheduler.
 * The claim RPC must ensure only one worker owns a processing job.
 * This worker is NOT an HTTP endpoint and does not enable delivery.
 */
export async function processClaimedInstitutionalJob({
  db, job, sendEmail, fromAddress, portalUrl, allowedPortalOrigins,
  now = new Date(),
}) {
  if (!db || !job?.id || job.status !== 'processing' || !job.claimed_at) throw new Error('A claimed job with lease timestamp is required');
  async function one(table, columns, column, value) {
    const { data, error } = await db.from(table).select(columns).eq(column, value).maybeSingle();
    if (error) throw error;
    return data;
  }
  const [attempt, recipient, settings, institution] = await Promise.all([
    one('assessment_attempts', 'id,user_id,status,completed_at', 'id', job.attempt_id),
    one('institution_assessment_recipients', 'id,user_id,tenant_institution_id,email,active,verified_at', 'id', job.recipient_id),
    one('institution_assessment_delivery_settings', 'tenant_institution_id,enabled,report_mode,authorization_reference', 'tenant_institution_id', job.tenant_institution_id),
    one('tenant_institutions', 'id,name', 'id', job.tenant_institution_id),
  ]);
  let studentMembership = null;
  if (attempt?.user_id) {
    const { data, error } = await db.from('institution_memberships')
      .select('user_id,tenant_institution_id,active')
      .eq('user_id', attempt.user_id)
      .eq('tenant_institution_id', job.tenant_institution_id)
      .eq('active', true).limit(1).maybeSingle();
    if (error) throw error;
    studentMembership = data;
  }
  const authorization = await one('institution_assessment_authorizations',
    'attempt_id,tenant_institution_id,approved,approved_at,revoked_at,authorization_reference',
    'attempt_id', job.attempt_id);
  let membership = null;
  if (recipient?.user_id) {
    const { data, error } = await db.from('institution_memberships')
      .select('user_id,tenant_institution_id,active')
      .eq('user_id', recipient.user_id)
      .eq('tenant_institution_id', job.tenant_institution_id)
      .eq('active', true).limit(1).maybeSingle();
    if (error) throw error;
    membership = data;
  }
  let update;
  try {
    const outcome = await sendInstitutionalNotification({
      job, attempt, recipient, membership, studentMembership, authorization, settings,
      institutionName: institution?.name, portalUrl, allowedPortalOrigins,
      sendEmail, fromAddress,
    });
    update = outcome.status === 'sent'
      ? { status: 'sent', provider_message_id: outcome.provider_message_id, sent_at: new Date(now).toISOString(), claimed_at: null }
      : { status: 'skipped', last_error_code: outcome.reason, claimed_at: null };
  } catch (error) {
    const retryCount = (job.retry_count ?? 0) + 1;
    const nextAttempt = nextInstitutionalDeliveryRetry({ retryCount: retryCount - 1, now });
    update = {
      status: nextAttempt ? 'failed' : 'skipped', retry_count: retryCount,
      ...(nextAttempt ? { next_attempt_at: nextAttempt } : {}), claimed_at: null,
      last_error_code: nextAttempt ? 'transient_delivery_failure' : 'retry_exhausted',
    };
  }
  const { data: updated, error: updateError } = await db.from('institution_assessment_delivery_jobs')
    .update(update).eq('id', job.id).eq('status', 'processing')
    .eq('claimed_at', job.claimed_at).select('id').maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error('Institutional delivery claim is no longer owned by this worker');
  return { jobId: job.id, status: update.status };
}
