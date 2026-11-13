import { createClient } from '@supabase/supabase-js';
import { listAuthorizedInstitutionalReports } from '../../../lib/institutionalReportList.mjs';

export const dynamic = 'force-dynamic';

// Returns only report metadata, never student data or assessment responses.
export async function GET(request) {
  // Explicit opt-in; new report endpoints must remain closed until staged authorization review.
  if (process.env.INSTITUTIONAL_REPORTS_ENABLED !== 'true') {
    return Response.json({ error: 'Institutional reporting is not enabled' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
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
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error } = await auth.auth.getUser(bearer);
    if (error || !user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const reports = await listAuthorizedInstitutionalReports({
      db, authenticatedUserId: user.id, limit: 25,
    });
    return Response.json({ reports }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return Response.json({ error: 'Report service unavailable' }, { status: 503 });
  }
}
