'use client';

import { useEffect, useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function accessToken() {
  let session;
  try { session = JSON.parse(localStorage.getItem('compassu_session') || 'null'); }
  catch { return null; }
  if (!session?.access_token) return null;
  if (!session.expires_at || Number(session.expires_at) * 1000 > Date.now() + 60000) {
    return session.access_token;
  }
  if (!session.refresh_token || !supabaseUrl || !publishableKey) return null;
  const response = await fetch(supabaseUrl + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) return null;
  const refreshed = await response.json();
  if (!refreshed?.access_token) return null;
  localStorage.setItem('compassu_session', JSON.stringify(refreshed));
  return refreshed.access_token;
}

export default function InstitutionalReportsHome() {
  const [status, setStatus] = useState('Checking institutional access…');
  const [reports, setReports] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await accessToken();
        if (!token) {
          if (!cancelled) setStatus('Please sign in to CompassU with your authorized institutional account.');
          return;
        }
        const response = await fetch('/api/institutional-reports', {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
        });
        if (response.status === 401) throw new Error('Your session has expired. Please sign in again.');
        if (!response.ok) throw new Error('Institutional reporting is not yet available. Please try again later.');
        const data = await response.json();
        if (!cancelled) {
          setReports(Array.isArray(data.reports) ? data.reports : []);
          setStatus('Report list checked. Access to individual reports is verified separately.');
        }
      } catch (error) {
        if (!cancelled) setStatus(error.message || 'Unable to load institutional reports.');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return <main style={{ maxWidth: 760, margin: '64px auto', padding: 24, fontFamily: 'Arial, sans-serif' }}>
    <h1>CompassU Institutional Reports</h1>
    <p role="status">{status}</p>
    <p>Secure report viewing is under development. No student assessment responses are displayed here.</p>
    {reports.length > 0 && <section aria-label="Authorized institutional report records">
      <h2>Authorized report records</h2>
      <ul>{reports.map(report => <li key={report.id}>
        <a href={'/institutional-reports/' + encodeURIComponent(report.id)}>
          {report.type === 'summary' ? 'Executive summary' : 'Full report'}
          {report.sentAt ? ' — notification sent ' + new Date(report.sentAt).toLocaleDateString() : ''}
        </a>
        {' — content not yet available'}
      </li>)}</ul>
    </section>}
    {status === 'Report list checked. Access to individual reports is verified separately.' && reports.length === 0 &&
      <p>No authorized institutional report records are available for your account.</p>}
    <p><a href="/">Return to CompassU</a></p>
  </main>;
}
