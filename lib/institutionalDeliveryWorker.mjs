import { sendInstitutionalNotification } from './institutionalNotificationSender.mjs';
import { sendInstitutionalFullReport } from './institutionalFullReportSender.mjs';
import { loadInstitutionalFullReport } from './institutionalFullReportLoader.mjs';
import { createCompletedStudentReportLoader } from './institutionalCompletedReportSnapshot.mjs';
import { canDispatchInstitutionalNotification } from './institutionalDispatchPolicy.mjs';
import { nextInstitutionalDeliveryRetry } from './institutionalDeliveryRetry.mjs';

/**
 * Process a job already atomically claimed by a trusted scheduler.
 * The claim RPC must ensure only one worker owns a processing job.
 * This worker is NOT an HTTP endpoint and does not enable delivery.
 */
export async function processClaimedInstitutionalJob({
  db, job, sendEmail, fromAddress, portalUrl, allowedPortalOrigins,
  loadCompletedStudentReport,
  now = new Date(),
}) {
  if (!db || !job?.id || job.status !== 'processing' || !job.claimed_at ||
      !job.attempt_id || !job.tenant_institution_id || !job.recipient_id ||
      !['summary', 'full'].includes(job.report_type)) {
    throw new Error('A valid claimed institutional job with lease timestamp is required');
  }
  async function one(table, columns, column, value) {
    const { data, error } = await db.from(table).select(columns).eq(column, value).maybeSingle();
    if (error) throw error;
    return data;
  }
  let update;
  try {
    const [attempt, recipient, settings, institution] = await Promise.all([
      one('assessment_attempts', 'id,user_id,status,completed_at', 'id', job.attempt_id),
      one('institution_assessment_recipients', 'id,user_id,tenant_institution_id,email,active,verified_at', 'id', job.recipient_id),
      one('institution_assessment_delivery_settings', 'tenant_institution_id,enabled,report_mode,authorization_reference', 'tenant_institution_id', job.tenant_institution_id),
      one('tenant_institutions', 'id,name', 'id', job.tenant_institution_id),
    ]);
    // Load the assessment-level tenant snapshot; staff roles do not establish
    // student affiliation. Missing evidence must prevent notification.
    const studentAffiliation = await one('institution_assessment_affiliations',
      'attempt_id,tenant_institution_id,evidence_reference', 'attempt_id', job.attempt_id);
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
    const shared = { job, attempt, recipient, membership, studentAffiliation,
      authorization, settings, institutionName: institution?.name,
      sendEmail, fromAddress };
    const outcome = job.report_type === 'full'
      ? await (async () => {
          // Do not load sensitive student report data before checking authorization.
          if (!canDispatchInstitutionalNotification(shared)) {
            return { status: 'skipped', reason: 'authorization_denied' };
          }
          // Fail closed: no report loader means no full-report email.
          const report = await loadInstitutionalFullReport({ attempt,
            loadCompletedStudentReport: loadCompletedStudentReport ??
              createCompletedStudentReportLoader({ db }) });
          if (report.tenantInstitutionId !== job.tenant_institution_id ||
              report.institutionName !== institution?.name) {
            throw new Error('Institutional report home institution mismatch');
          }
          // Report generation may take time. Re-read authorization immediately
          // before dispatch so a revocation during loading blocks delivery.
          const latestAuthorization = await one('institution_assessment_authorizations',
            'attempt_id,tenant_institution_id,approved,approved_at,revoked_at,authorization_reference',
            'attempt_id', job.attempt_id);
          const { data: latestMembership, error: membershipError } = await db
            .from('institution_memberships')
            .select('user_id,tenant_institution_id,active')
            .eq('user_id', recipient.user_id)
            .eq('tenant_institution_id', job.tenant_institution_id)
            .eq('active', true).limit(1).maybeSingle();
          if (membershipError) throw membershipError;
          const latestRecipient = await one('institution_assessment_recipients',
            'id,user_id,tenant_institution_id,email,active,verified_at',
            'id', job.recipient_id);
          const latestSettings = await one('institution_assessment_delivery_settings',
            'tenant_institution_id,enabled,report_mode,authorization_reference',
            'tenant_institution_id', job.tenant_institution_id);
          if (!canDispatchInstitutionalNotification({
            ...shared, authorization: latestAuthorization,
            membership: latestMembership, recipient: latestRecipient,
            settings: latestSettings,
          })) {
            return { status: 'skipped', reason: 'authorization_denied' };
          }
          return sendInstitutionalFullReport({ ...shared,
            authorization: latestAuthorization, membership: latestMembership,
            recipient: latestRecipient, settings: latestSettings,
            studentName: report.studentName, sections: report.sections, dryRun: false });
        })()
      : await sendInstitutionalNotification({ ...shared, portalUrl, allowedPortalOrigins });
    update = outcome.status === 'sent'
      ? { status: 'sent', provider_message_id: outcome.provider_message_id, sent_at: new Date(now).toISOString(), claimed_at: null }
      : { status: 'skipped', last_error_code: outcome.reason, claimed_at: null };
  } catch (error) {
    const retryCount = (job.retry_count ?? 0) + 1;
    // Missing/invalid configuration is permanent until an administrator fixes it.
    // Do not repeatedly send or retry malformed portal links or absent transport.
    const message = String(error?.message ?? '');
    const permanentConfigurationFailure = /Institutional email transport is not configured|Sender address is required|Institution is required|Unsupported report type|Completed student report snapshot is unavailable|Trusted student report loader is not configured|Completed student report does not match the assessment|Missing verified institutional identity in student report|Institutional report home institution mismatch|Missing or invalid full-report field|Invalid email header field|Missing or invalid completion date|Full assessment report is required|A completed assessment is required|Invalid portal URL|secure HTTPS portal URL|Portal origin is not authorized|Portal URL must be an unparameterized institutional reports page/.test(message);
    const isProviderConfirmationUncertain = /Email provider did not confirm message acceptance|Resend response lacked a message identifier|Resend delivery confirmation uncertain after network failure/.test(message);
    const nextAttempt = (retryCount >= 5 || permanentConfigurationFailure || isProviderConfirmationUncertain)
      ? null : nextInstitutionalDeliveryRetry({ retryCount: retryCount - 1, now });
    update = {
      status: nextAttempt ? 'failed' : 'skipped', retry_count: retryCount,
      ...(nextAttempt ? { next_attempt_at: nextAttempt } : {}), claimed_at: null,
      last_error_code: isProviderConfirmationUncertain ? 'provider_confirmation_uncertain' : (permanentConfigurationFailure ? 'configuration_error' : (nextAttempt ? 'transient_delivery_failure' : 'retry_exhausted')),
    };
  }
  const { data: updated, error: updateError } = await db.from('institution_assessment_delivery_jobs')
    .update(update).eq('id', job.id).eq('status', 'processing')
    .eq('claimed_at', job.claimed_at).select('id').maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error('Institutional delivery claim is no longer owned by this worker');
  return { jobId: job.id, status: update.status };
}
