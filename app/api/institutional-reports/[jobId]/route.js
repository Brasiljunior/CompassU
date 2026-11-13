import { createClient } from '@supabase/supabase-js';
import { authorizeInstitutionalReportView } from '../../../../lib/institutionalReportLookup.mjs';
import { buildInstitutionalExecutiveSummary } from '../../../../lib/institutionalExecutiveSummary.mjs';

export const dynamic = 'force-dynamic';

// Metadata-only endpoint. This does not expose student assessment results.
export async function GET(request, { params }) {
  // Explicit opt-in; new report endpoints must remain closed until staged authorization review.
  if (process.env.INSTITUTIONAL_REPORTS_ENABLED !== 'true') {
    return Response.json({ error: 'Institutional reporting is not enabled' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const { jobId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId ?? '')) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  const bearer = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!bearer) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return Response.json({ error: 'Report service unavailable' }, { status: 503 });
  }
  try {
    // Authenticated user identity comes only from Supabase verification.
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await auth.auth.getUser(bearer);
    if (error || !user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await authorizeInstitutionalReportView({
      db, authenticatedUserId: user.id, jobId,
    });
    if (!result.allowed) return Response.json({ error: 'Not found' }, { status: 404 });
    // The executive summary uses persisted, ranked major matches only.
    // Do not fetch assessment answers or profiles. Full report content remains unavailable.
    if (result.reportType === 'summary') {
      const { data: matches, error: matchesError } = await db.from('major_matches')
        .select('major_id,match_score,rank,majors(name)')
        .eq('attempt_id', result.attemptId)
        .order('rank', { ascending: true })
        .limit(10);
      if (matchesError) throw matchesError;
      if (!matches?.length) return Response.json({ error: 'Report content unavailable' }, {
        status: 404, headers: { 'Cache-Control': 'no-store' },
      });
      const summary = buildInstitutionalExecutiveSummary({ matches, attemptId: result.attemptId });
      if (!summary.topMajors.length) return Response.json({ error: 'Report content unavailable' }, {
        status: 404, headers: { 'Cache-Control': 'no-store' },
      });
      return Response.json({ report: { id: result.jobId, type: 'summary', available: true, content: summary } }, {
        headers: { 'Cache-Control': 'no-store, private' },
      });
    }
    return Response.json({ report: { id: result.jobId, type: result.reportType, available: false, accessVerified: true } }, {
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch {
    return Response.json({ error: 'Report service unavailable' }, { status: 503 });
  }
}
