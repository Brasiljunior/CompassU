import { captureCompletedAssessmentAffiliation } from './institutionalCompletionSnapshotCapture.mjs';
import { persistInstitutionalFullReportSnapshot } from './institutionalSnapshotWriter.mjs';
import { enqueueCompletedInstitutionalAssessment } from './institutionalCompletionBridge.mjs';

/**
 * Server-only integration point for an independently authenticated, trusted
 * assessment finalization callback. No browser-supplied report is accepted.
 * The caller must supply a service-role DB client and server-side report generator.
 * Does not expose a route, scheduler, or automatically activate delivery.
 */
export async function finalizeInstitutionalAssessmentDelivery({
  db, attemptId, completedUserId, generateReport,
}) {
  if (!db?.from || !attemptId || !completedUserId ||
      typeof generateReport !== 'function') {
    throw new Error('Trusted institutional finalization context required');
  }
  const capture = await captureCompletedAssessmentAffiliation({
    db, attemptId, completedUserId,
  });
  if (!capture.captured) {
    return { queued: 0, stage: 'affiliation', reason: capture.reason };
  }
  // Do not generate or persist sensitive reports unless the home institution
  // has explicitly enabled full-report delivery.
  const { data: affiliation, error: affiliationError } = await db
    .from('institution_assessment_affiliations')
    .select('tenant_institution_id')
    .eq('attempt_id', attemptId).maybeSingle();
  if (affiliationError) throw affiliationError;
  if (!affiliation?.tenant_institution_id) {
    return { queued: 0, stage: 'settings', reason: 'verified_affiliation_unavailable' };
  }
  const { data: settings, error: settingsError } = await db
    .from('institution_assessment_delivery_settings')
    .select('enabled,report_mode')
    .eq('tenant_institution_id', affiliation.tenant_institution_id).maybeSingle();
  if (settingsError) throw settingsError;
  if (settings?.enabled !== true || settings.report_mode !== 'full') {
    return { queued: 0, stage: 'settings', reason: 'full_report_delivery_not_enabled' };
  }
  await persistInstitutionalFullReportSnapshot({ db, attemptId, generateReport });
  const outcome = await enqueueCompletedInstitutionalAssessment({ db, attemptId });
  return { ...outcome, stage: 'outbox' };
}
