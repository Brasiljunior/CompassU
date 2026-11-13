import { authorizeInstitutionalReportView } from './institutionalReportLookup.mjs';

/**
 * Server-only list of delivered reports for a verified Supabase Auth user.
 * The database client must use the service role; never expose it to browsers.
 * Revalidates every candidate against current membership, consent and settings,
 * so revocations take effect even after an email has been sent.
 */
export async function listAuthorizedInstitutionalReports({
  db, authenticatedUserId, limit = 25,
}) {
  if (!db || !authenticatedUserId) return [];
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid report list limit');
  }
  const { data: recipients, error: recipientError } = await db
    .from('institution_assessment_recipients')
    .select('id,tenant_institution_id')
    .eq('user_id', authenticatedUserId)
    .eq('active', true)
    .not('verified_at', 'is', null);
  if (recipientError) throw recipientError;
  if (!recipients?.length) return [];

  const recipientIds = [...new Set(recipients.map(({ id }) => id).filter(Boolean))];
  if (!recipientIds.length) return [];
  // Bound candidate scan; no student identifiers or assessment answers are returned.
  const { data: candidates, error: jobError } = await db
    .from('institution_assessment_delivery_jobs')
    .select('id,report_type,sent_at')
    .in('recipient_id', recipientIds)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(Math.min(500, limit * 5));
  if (jobError) throw jobError;

  const reports = [];
  for (const candidate of candidates ?? []) {
    // Fail closed for individual records whose authorization cannot be verified.
    // An isolated corrupt or revoked record must not expose metadata.
    let access;
    try {
      access = await authorizeInstitutionalReportView({
        db, authenticatedUserId, jobId: candidate.id,
      });
    } catch {
      continue;
    }
    if (!access.allowed) continue;
    reports.push({
      id: candidate.id,
      type: access.reportType,
      sentAt: candidate.sent_at,
      // Content is not yet implemented. Do not imply the report can be viewed.
      contentAvailable: false,
    });
    if (reports.length >= limit) break;
  }
  return reports;
}
