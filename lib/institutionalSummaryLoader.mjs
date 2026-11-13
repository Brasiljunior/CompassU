import { authorizeInstitutionalReportView } from './institutionalReportLookup.mjs';
import { buildInstitutionalExecutiveSummary } from './institutionalExecutiveSummary.mjs';

/**
 * Trusted server-only report loader. Authenticate the user before calling.
 * Authorization is checked before reading scoring rows and again before returning.
 * Never query raw responses, profiles, or student contact details.
 */
export async function loadAuthorizedInstitutionalSummary({ db, authenticatedUserId, jobId, authorize = authorizeInstitutionalReportView }) {
  if (!db || !authenticatedUserId || !jobId) return { status: 'denied' };
  const initial = await authorize({ db, authenticatedUserId, jobId });
  if (!initial?.allowed || initial.reportType !== 'summary' || !initial.attemptId) return { status: 'denied' };
  const { data: matches, error } = await db.from('major_matches')
    .select('major_id,match_score,rank,majors(name)')
    .eq('attempt_id', initial.attemptId)
    .order('rank', { ascending: true })
    .limit(10);
  if (error) throw error;
  if (!matches?.length) return { status: 'unavailable' };
  const content = buildInstitutionalExecutiveSummary({ matches, attemptId: initial.attemptId });
  if (!content.topMajors.length) return { status: 'unavailable' };
  const current = await authorize({ db, authenticatedUserId, jobId });
  if (!current?.allowed || current.reportType !== 'summary' ||
      current.attemptId !== initial.attemptId || current.jobId !== initial.jobId) {
    return { status: 'denied' };
  }
  return { status: 'available', report: { id: initial.jobId, type: 'summary', available: true, content } };
}
