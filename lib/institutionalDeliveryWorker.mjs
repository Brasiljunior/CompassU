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
  if (!db || !job?.id || job.status !== 'processing') throw new Error('A claimed job is required');
  async function one(table, columns, column, value) {
    const { data, error } = await db.from(table).select(columns).eq(column, value).maybeSingle();
    if (error) throw error;
    return data;
  }
  const [attempt, recipient, settings, institution] = await Promise.all([
    one('assessment_attempts', 'id,status,completed_at', 'id', job.attempt_id),
    one('institution_assessment_recipients', 'id,user_id,tenant_institution_id,email,active,verified_at', 'id', job.recipient_id),
    one('institution_assessment_delivery_settings', 'tenant_institution_id,enabled,report_mode,authorization_reference', 'tenant_institution_id', job.tenant_institution_id),
    one('tenant_institutions', 'id,name', 'id', job.tenant_institution_id),
  ]);
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
      job, attempt, recipient, membership, settings,
      institutionName: institution?.name, portalUrl, allowedPortalOrigins,
      sendEmail, fromAddress,
    });
    update = outcome.status === 'sent'
      ? { status: 'sent', provider_message_id: outcome.provider_message_id, sent_at: new Date(now).toISOString(), claimed_at: null }
      : { status: 'skipped', last_error_code: outcome.reason, claimed_at: null };
  } catch (error) {
    const retryCount = (job.retry_count ?? 0) + 1;
    const nextAttempt = nextInstitutionalDeliveryRetry({ retryCount, now });
    update = {
      status: 'failed', retry_count: retryCount,
      next_attempt_at: nextAttempt, claimed_at: null,
      last_error_code: nextAttempt ? 'transient_delivery_failure' : 'retry_exhausted',
    };
  }
  const { error: updateError } = await db.from('institution_assessment_delivery_jobs')
    .update(update).eq('id', job.id).eq('status', 'processing');
  if (updateError) throw updateError;
  return { jobId: job.id, status: update.status };
}
