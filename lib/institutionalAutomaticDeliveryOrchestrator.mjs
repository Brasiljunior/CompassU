import { prepareAutomaticInstitutionalDelivery } from './institutionalAutomaticDeliveryPreflight.mjs';

/**
 * Server-only orchestration. The loader must independently fetch all records
 * using trusted credentials; the browser supplies only the attempt ID.
 * Provider acceptance is not proof of inbox delivery.
 */
export async function deliverAutomaticInstitutionalReport({
  attemptId, completionEvent, loadTrustedContext, sendEmail, fromAddress, claimDelivery, recordDelivery,
}) {
  if (typeof attemptId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) {
    return { status:'blocked',reason:'invalid_attempt_id' };
  }
  // Only a trusted, newly finalized assessment event can trigger delivery.
  // This prevents historical test assessments from being backfilled or emailed.
  if (!completionEvent || completionEvent.source !== 'trusted_assessment_finalization' ||
      completionEvent.attemptId !== attemptId || completionEvent.isNewCompletion !== true) {
    return {status:'blocked',reason:'fresh_completion_event_required'};
  }
  if (typeof loadTrustedContext !== 'function' || typeof claimDelivery !== 'function' ||
      typeof recordDelivery !== 'function' || typeof sendEmail !== 'function' ||
      !fromAddress) throw new Error('Trusted institutional delivery dependencies missing');
  let context;
  try {
    context=await loadTrustedContext(attemptId);
  } catch {
    return {status:'blocked',reason:'trusted_context_unavailable'};
  }
  if (!context || typeof context !== 'object') {
    return {status:'blocked',reason:'trusted_context_unavailable'};
  }
  let prepared;
  try {
    prepared=prepareAutomaticInstitutionalDelivery(context);
  } catch {
    return {status:'blocked',reason:'trusted_context_invalid'};
  }
  if (!prepared.ready) return {status:'blocked',reason:prepared.reason};
  if (prepared.attemptId !== attemptId) return {status:'blocked',reason:'attempt_mismatch'};
  const recipient=prepared.recipientEmails[0];
  const claim=await claimDelivery({attemptId,recipient});
  if (!claim?.claimed) return {status:'skipped',reason:claim?.reason||'already_claimed'};
  const idempotencyKey='institutional-full-report/'+attemptId+'/'+recipient;
  try {
    const result=await sendEmail({from:fromAddress,to:[recipient],subject:prepared.subject,
      text:prepared.text,idempotencyKey});
    if (!result?.id) throw new Error('Provider acceptance was not confirmed');
    try {
      await recordDelivery({attemptId,recipient,status:'sent',providerMessageId:result.id});
    } catch {
      // Provider accepted the message; never classify this as an email failure.
      // Keep the claim held and require reconciliation of the database status.
      return {status:'reconciliation_required',reason:'provider_accepted_but_recording_failed',providerMessageId:result.id};
    }
    return {status:'accepted',providerMessageId:result.id};
  } catch(error) {
    // The provider may have accepted the message before a timeout.
    // Record an uncertain outcome and never retry without reconciliation.
    try {
      await recordDelivery({attemptId,recipient,status:'failed',error:'provider_outcome_uncertain'});
    } catch {
      // Keep the claimed job held; a failed status write cannot justify a resend.
      return {status:'reconciliation_required',reason:'provider_and_recording_outcomes_uncertain'};
    }
    return {status:'failed',reason:'provider_outcome_uncertain'};
  }
}
