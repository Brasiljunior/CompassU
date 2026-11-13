import { createClient } from '@supabase/supabase-js';
import { runInstitutionalCompletionBatch } from '../../../../lib/institutionalCompletionBatch.mjs';

export const dynamic = 'force-dynamic';

// Read-only preview endpoint. Never schedules or sends institutional emails.
// Requires an independent opt-in and a server-only bearer secret.
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.INSTITUTIONAL_RECONCILIATION_PREVIEW_ENABLED !== 'true') {
    return Response.json({ error: 'Preview unavailable' }, { status: 503, headers });
  }
  const secret = process.env.INSTITUTIONAL_RECONCILIATION_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || secret.length < 32 || authorization !== 'Bearer ' + secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: 'Preview unavailable' }, { status: 503, headers });
  }
  try {
    // Fixed, short lookback; no browser-controlled assessment, tenant, or window.
    const completedBefore = new Date();
    const completedAfter = new Date(completedBefore.getTime() - 24 * 60 * 60 * 1000);
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await runInstitutionalCompletionBatch({
      db, completedAfter: completedAfter.toISOString(),
      completedBefore: completedBefore.toISOString(), limit: 50, dryRun: true,
    });
    // Only aggregate counts; no attempt IDs or student records.
    return Response.json({
      dryRun: true,
      candidateCount: result.candidateCount,
      potentiallyMoreCandidates: result.potentiallyMoreCandidates,
    }, { headers });
  } catch {
    return Response.json({ error: 'Preview unavailable' }, { status: 503, headers });
  }
}
