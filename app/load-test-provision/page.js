'use client';

import { useEffect, useState } from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function LoadTestProvision(){
 const [session,setSession]=useState(null);
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState(null);
 const [error,setError]=useState('');
 useEffect(()=>{try{setSession(JSON.parse(localStorage.getItem('compassu_session')||'null'))}catch{}},[]);
 const provision=async()=>{
  if(!session?.access_token){setError('Please sign in to CompassU first, then return to this page.');return;}
  setBusy(true);setError('');setResult(null);
  try{
   const r=await fetch(`${SUPABASE_URL}/functions/v1/load-test-provision-users`,{
    method:'POST',
    headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
    body:JSON.stringify({count:50,prefix:'compassu-loadtest',password:'CompassULoadTest!2026'})
   });
   const b=await r.json();
   if(!r.ok)throw new Error(b.error||'Provisioning failed');
   setResult(b);
  }catch(e){setError(e.message||'Provisioning failed');}
  finally{setBusy(false);}
 };
 return <main style={{maxWidth:760,margin:'60px auto',padding:24,fontFamily:'Arial,sans-serif'}}>
  <h1>CompassU Isolated Load-Test Provisioning</h1>
  <p>This control is for the <b>load-test-pilot-10k</b> Preview environment only. It creates 50 auto-confirmed synthetic users and sends no invitation or confirmation emails.</p>
  <button onClick={provision} disabled={busy} style={{padding:'14px 22px',fontSize:16,fontWeight:700}}>{busy?'Creating synthetic users…':'Create 50 Synthetic Users'}</button>
  {error&&<p style={{marginTop:20}}><b>Error:</b> {error}</p>}
  {result&&<div style={{marginTop:20}}><h2>Provisioning complete</h2><p>Requested: {result.requested} · Created: {result.created} · Failed: {result.failed}</p></div>}
 </main>;
}
