'use client';

import { useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const baseHeaders = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

export default function ForgotPassword(){
  const[email,setEmail]=useState('');
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);

  async function sendReset(){
    setBusy(true);setMessage('');setError('');
    try{
      if(!email.trim())throw new Error('Enter the email address associated with your CompassU account.');
      const redirectTo='https://getcompassu.com/reset-password';
      const response=await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,{
        method:'POST',headers:baseHeaders,body:JSON.stringify({email:email.trim().toLowerCase()})
      });
      const text=await response.text();
      let body={};
      try{body=text?JSON.parse(text):{}}catch{}
      if(!response.ok)throw new Error(body?.msg||body?.error_description||body?.message||'Unable to send password reset email.');
      setMessage('If a CompassU account exists for that email address, a password reset link has been sent. Please check your inbox and spam folder.');
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <div>
    <nav className="nav"><a href="/" className="brand brandBtn" style={{textDecoration:'none'}}>Compass<span>U</span></a><div className="navActions"><a className="btn ghost" href="/">Back to CompassU</a></div></nav>
    <div className="center"><div className="panel">
      <span className="eyebrow">Account Recovery</span>
      <h2>Reset your password</h2>
      <p className="muted">Enter the email address you used to create your CompassU account. We’ll send you a secure link to choose a new password.</p>
      <div className="field"><label>Email</label><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!busy)sendReset()}}/></div>
      {message&&<div className="success">{message}</div>}
      {error&&<div className="error">{error}</div>}
      <button className="btn primary wide" disabled={busy} onClick={sendReset}>{busy?'Sending…':'Send Password Reset Link'}</button>
      <div style={{marginTop:18,textAlign:'center'}}><a href="/" className="muted">Return to login</a></div>
    </div></div>
  </div>;
}
