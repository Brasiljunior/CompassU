'use client';

import { useEffect, useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const baseHeaders = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

function getSession(){try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}}
function saveSession(session){localStorage.setItem('compassu_session',JSON.stringify(session))}

export default function AcceptInvite(){
  const[ready,setReady]=useState(false);
  const[pendingToken,setPendingToken]=useState(null);
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[confirmPassword,setConfirmPassword]=useState('');
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    async function initialize(){
      try{
        const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
        const accessToken=hash.get('access_token');
        const refreshToken=hash.get('refresh_token');
        const tokenType=hash.get('token_type')||'bearer';
        const expiresIn=Number(hash.get('expires_in')||3600);
        const hashError=hash.get('error_description');

        if(hashError){
          if(!cancelled)setError(hashError.replace(/\+/g,' '));
          return;
        }

        if(accessToken){
          const userRes=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}});
          const user=await userRes.json().catch(()=>({}));
          if(!userRes.ok)throw new Error(user?.msg||user?.error_description||user?.message||'Unable to accept this invitation.');
          const session={access_token:accessToken,refresh_token:refreshToken,token_type:tokenType,expires_in:expiresIn,user};
          saveSession(session);
          history.replaceState({},document.title,window.location.pathname);
          if(!cancelled){setReady(true);setEmail(user?.email||'');setPendingToken(null)}
          return;
        }

        const existing=getSession();
        if(existing?.access_token){
          if(!cancelled){setReady(true);setEmail(existing?.user?.email||'')}
          return;
        }

        const params=new URLSearchParams(window.location.search);
        const tokenHash=params.get('token_hash');
        const type=params.get('type')||'invite';
        if(tokenHash){
          if(!cancelled)setPendingToken({tokenHash,type});
          return;
        }
      }catch(e){if(!cancelled)setError(e.message)}finally{if(!cancelled)setLoading(false)}
    }
    initialize();
    return()=>{cancelled=true};
  },[]);

  function acceptInvitation(){
    if(!pendingToken){setError('This invitation is missing its verification token. Please request a new invitation.');return;}
    setBusy(true);setError('');
    const redirectTo=`${window.location.origin}/accept-invite`;
    const verifyUrl=`${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(pendingToken.tokenHash)}&type=${encodeURIComponent(pendingToken.type||'invite')}&redirect_to=${encodeURIComponent(redirectTo)}`;
    window.location.href=verifyUrl;
  }

  async function createPassword(){
    setBusy(true);setMessage('');setError('');
    try{
      const session=getSession();
      if(!session?.access_token)throw new Error('This invitation is no longer active. Ask a CompassU administrator to send a new invitation.');
      if(password.length<8)throw new Error('Your password must be at least 8 characters long.');
      if(password!==confirmPassword)throw new Error('The passwords do not match.');
      const metadata={...(session.user?.user_metadata||{}),compassu_account_setup_required:false,compassu_account_setup_completed:true};
      const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
        method:'PUT',headers:{...baseHeaders,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({password,data:metadata})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.msg||body?.error_description||body?.message||'Unable to create your password.');
      localStorage.removeItem('compassu_session');
      sessionStorage.removeItem('compassu_confirmation_reloaded');
      setPassword('');setConfirmPassword('');setReady(false);
      setMessage('Your CompassU account is ready. Your password has been created successfully. You can now log in and begin your journey.');
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <div>
    <nav className="nav"><a href="/" className="brand brandBtn" style={{textDecoration:'none'}}>Compass<span>U</span></a><div className="navActions"><a className="btn ghost" href="/">Back to CompassU</a></div></nav>
    <div className="center"><div className="panel">
      <span className="eyebrow">Welcome to CompassU</span>
      <h2>Create your account password</h2>
      {loading?<p className="muted">Preparing your CompassU invitation…</p>:message?<>
        <div className="success">{message}</div>
        <a className="btn primary wide" href="/">Log in to CompassU</a>
      </>:ready?<>
        <p className="muted">Your invitation has been accepted. Create a password to finish setting up your CompassU account.</p>
        {email&&<div className="field"><label>Email</label><input type="email" value={email} disabled readOnly/></div>}
        <div className="field"><label>Create password</label><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></div>
        <div className="field"><label>Confirm password</label><input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!busy)createPassword()}}/></div>
        <div className="small muted" style={{marginBottom:14}}>Use at least 8 characters. Choose a password you do not use for another account.</div>
        {error&&<div className="error">{error}</div>}
        <button className="btn primary wide" disabled={busy} onClick={createPassword}>{busy?'Creating account…':'Create Password & Finish Setup'}</button>
      </>:pendingToken?<>
        <p className="muted">Your invitation is ready. To protect your one-time invitation from automated email scanners, please confirm that you want to continue.</p>
        {error&&<div className="error">{error}</div>}
        <button type="button" className="btn primary wide" disabled={busy} onClick={acceptInvitation}>{busy?'Accepting invitation…':'Accept Invitation & Continue'}</button>
      </>:<>
        <div className="error">{error||'This invitation session is missing or has expired.'}</div>
        <p className="muted">Please request a new CompassU invitation and use the newest invitation email.</p>
        <a className="btn ghost wide" href="/">Return to CompassU</a>
      </>}
    </div></div>
  </div>;
}
