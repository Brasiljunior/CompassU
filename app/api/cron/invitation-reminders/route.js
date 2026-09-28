export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvvgalifibyqwebasalx.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!base || !key || !resendKey) return Response.json({ error: 'Reminder service is not configured' }, { status: 503 });
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const app = (process.env.COMPASSU_APP_URL || 'https://getcompassu.com').replace(/\/$/, '');
  const from = process.env.COMPASSU_FROM_EMAIL || 'CompassU <results@getcompassu.com>';
  const claim = await fetch(`${base}/rest/v1/rpc/claim_invitation_reminders`, { method: 'POST', headers, body: JSON.stringify({ p_limit: 100 }), cache: 'no-store' });
  if (!claim.ok) return Response.json({ error: 'Unable to claim reminders' }, { status: 502 });
  const rows = await claim.json();
  let sent = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const record = `${base}/rest/v1/invitation_reminders?email=eq.${encodeURIComponent(row.email)}&reminders_sent=eq.${row.reminders_sent}`;
    const patch = async (values) => fetch(record, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(values) });
    try {
      if (!row.user_id) throw new Error('Invitation has no user identifier');
      const ur = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(row.user_id)}`, { headers, cache: 'no-store' });
      if (ur.status === 404) { await patch({ reminders_sent: 2, claimed_at: null }); skipped++; continue; }
      if (!ur.ok) throw new Error('Unable to check invitation status');
      const user = await ur.json();
      if (user.user_metadata?.compassu_account_setup_completed === true || user.user_metadata?.compassu_account_setup_required === false || user.email?.toLowerCase() !== row.email.toLowerCase()) {
        await patch({ reminders_sent: 2, claimed_at: null }); skipped++; continue;
      }
      // Generate a fresh one-time link for each reminder so the original link's expiry does not strand the user.
      const lr = await fetch(`${base}/auth/v1/admin/generate_link`, { method: 'POST', headers, body: JSON.stringify({ type: 'invite', email: row.email, redirect_to: `${app}/accept-invite` }) });
      if (!lr.ok) throw new Error('Unable to refresh invitation link');
      const linkData = await lr.json();
      const token = linkData?.properties?.hashed_token || linkData?.hashed_token;
      if (!token) throw new Error('Missing invitation token');
      const link = `${app}/accept-invite?token_hash=${encodeURIComponent(token)}&type=invite`;
      const ordinal = row.reminders_sent === 0 ? 'first' : 'final';
      const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>CompassU</h1><p>Hello ${esc(row.first_name) || 'there'},</p><p>This is your ${ordinal} reminder to create your CompassU account and explore your college and career options.</p><p style="margin:28px 0"><a href="${link}" style="background:#2f6fed;color:white;text-decoration:none;padding:15px 25px;border-radius:12px;font-weight:800">Create My CompassU Account →</a></p><p>If you already created your account, you can ignore this email.</p></div>`;
      const rr = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [row.email], subject: row.reminders_sent === 0 ? 'Reminder: Your CompassU invitation 🧭' : 'Final reminder: Create your CompassU account 🧭', html }) });
      if (!rr.ok) throw new Error('Email delivery request failed');
      const updated = await patch({ reminders_sent: row.reminders_sent + 1, last_sent_at: new Date().toISOString(), claimed_at: null });
      if (!updated.ok) throw new Error('Reminder delivery was not recorded');
      sent++;
    } catch (error) {
      failed++;
      console.error('Invitation reminder failed', row.email, error);
      await patch({ claimed_at: null });
    }
  }
  return Response.json({ claimed: rows.length, sent, skipped, failed });
}
