'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function InstitutionalReportPage() {
  const { jobId } = useParams();
  const [status, setStatus] = useState('Checking your institutional access…');
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // CompassU uses its own compassu_session storage, not supabase-js storage.
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('Institutional access is not configured.');
        let session;
        try { session = JSON.parse(localStorage.getItem('compassu_session') || 'null'); } catch { session = null; }
        if (!session?.access_token) {
          if (!cancelled) setStatus('Please sign in to CompassU before opening an institutional report.');
          return;
        }
        if (session.expires_at && Number(session.expires_at) * 1000 <= Date.now() + 60000) {
          if (!session.refresh_token) throw new Error('Your CompassU session expired. Please sign in again.');
          const refreshed = await fetch(url + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token }),
          });
          if (!refreshed.ok) throw new Error('Your CompassU session expired. Please sign in again.');
          session = await refreshed.json();
          if (!session?.access_token) throw new Error('Your CompassU session expired. Please sign in again.');
          localStorage.setItem('compassu_session', JSON.stringify(session));
        }
        const response = await fetch('/api/institutional-reports/' + encodeURIComponent(jobId), {
          headers: { Authorization: 'Bearer ' + session.access_token },
          cache: 'no-store',
        });
        if (response.status === 404) throw new Error('This report is not available to your account.');
        if (!response.ok) throw new Error('The report service is temporarily unavailable.');
        const data = await response.json();
        if (!cancelled) {
          setReport(data.report);
          setStatus('Your institutional access was verified.');
        }
      } catch (error) {
        if (!cancelled) setStatus(error.message || 'Unable to verify access.');
      }
    }
    if (jobId) load();
    return () => { cancelled = true; };
  }, [jobId]);

  return <main style={{ maxWidth: 720, margin: '64px auto', padding: 24, fontFamily: 'Arial, sans-serif' }}>
    <h1>CompassU Institutional Reports</h1>
    <p role="status">{status}</p>
    {report && <section aria-label="Report status">
      <p>Report type: {report.type === 'summary' ? 'Executive summary' : 'Full report'}</p>
      <p>The secure assessment report viewer is being prepared. Student results are not yet available on this page.</p>
    </section>}
    <p><a href="/">Return to CompassU</a></p>
  </main>;
}
