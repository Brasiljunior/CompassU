'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

export default function InstitutionalReportPage() {
  const { jobId } = useParams();
  const [status, setStatus] = useState('Checking your institutional access…');
  const [report, setReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('Institutional access is not configured.');
        const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: { session } } = await auth.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setStatus('Please sign in to CompassU before opening an institutional report.');
          return;
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
