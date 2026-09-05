'use client';

import { useEffect, useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const baseHeaders = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

function getSession(){try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}}

export default function ResetPassword(){
  const[ready,setReady]=useState(false);
  const[password,setPassword]=useState('');
  const[confirmPassword,setConfirmPassword]=useState('');
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);

  useEffect(()=>{setReady(Boolean(getSession()?.access_token))},[]);

  async function updatePassword(){
    setBusy(true);setMessage('');setError('');
    try{
      const session=getSession();
      if(!session?.access_token)throw new Error('This password reset link is no longer active. Request a new reset link and try again.');
      if(password.length<8)throw new Error('Your new password must be at least 8 characters long.');
      if(password!==confirmPassword)throw new Error('The passwords do not match.');
      const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
        method:'PUT',
        headers:{...baseHeaders,Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({password})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.msg||body?.error_description||body?.message||'Unable to update your password.');
      localStorage.removeItem('compassu_session');
      setPassword('');setConfirmPassword('');setReady(false);
      setMessage('Your CompassU password has been updated successfully. You can now return to CompassU and log in with your new password.');
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <div>
    <nav className="nav"><a href="/" className="brand brandBtn" style={{textDecoration:'none'}}>Compass<span>U</span></a><div className="navActions"><a className="btn ghost" href="/">Back to CompassU</a></div></nav>
    <div className="center"><div className="panel">
      <span className="eyebrow">Account Recovery</span>
      <h2>Create a new password</h2>
      {message?<>
        <div className="success">{message}</div>
        <a className="btn primary wide" href="/">Return to CompassU</a>
      </>:ready?<>
        <p className="muted">Choose a new password for your CompassU account.</p>
        <div className="field"><label>New password</label><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></div>
        <div className="field"><label>Confirm new password</label><input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!busy)updatePassword()}}/></div>
        {error&&<div className="error">{error}</div>}
        <button className="btn primary wide" disabled={busy} onClick={updatePassword}>{busy?'Updating…':'Update Password'}</button>
      </>:<>
        <div className="error">This password reset session is missing or has expired.</div>
        <a className="btn primary wide" href="/forgot-password">Request a New Reset Link</a>
      </>}
    </div></div>
  </div>;
}
