'use client';

import { useEffect, useState } from 'react';

export default function InstitutionalReportsHome() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('compassu_session') || 'null');
      setSignedIn(Boolean(session?.access_token));
    } catch { setSignedIn(false); }
  }, []);
  return <main style={{ maxWidth: 720, margin: '64px auto', padding: 24, fontFamily: 'Arial, sans-serif' }}>
    <h1>CompassU Institutional Reports</h1>
    <p>This institutional reporting portal is under development and is not yet available for assessment report delivery.</p>
    {signedIn
      ? <p>You are signed in to CompassU. Institutional report listings and secure report viewing will be available after testing and authorization review.</p>
      : <p>Please sign in to CompassU using your authorized institutional account. Signing in does not automatically grant access to student assessment information.</p>}
    <p>No student results are displayed on this page.</p>
    <p><a href="/">Return to CompassU</a></p>
  </main>;
}
