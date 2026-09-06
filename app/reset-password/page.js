'use client';

import { useEffect, useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const baseHeaders = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

function getSession(){try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}}

export default function ResetPassword(){
  const[ready,setReady]=useState(false);
  const[pendingTokenHash,setPendingTokenHash]=useState('');
  const[password,setPassword]=useState('');
  const[confirmPassword,setConfirmPassword]=useState('');
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);

  useEffect(()=>{
    const initialize=async()=>{
      try{
        const query=new URLSearchParams(window.location.search);
        const tokenHash=query.get('token_hash');
        const queryType=query.get('type');

        if(tokenHash&&queryType==='recovery'){
          setPendingTokenHash(tokenHash);
          setReady(false);
          return;
        }

        const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
        const accessToken=hash.get('access_token');
        const refreshToken=hash.get('refresh_token')||'';
        const authType=hash.get('type');

        if(accessToken&&authType==='recovery'){
          const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}
          });
          if(!response.ok)throw new Error('This password reset link is invalid or has expired.');
          const user=await response.json();
          const expiresIn=Number(hash.get('expires_in')||3600);
          const session={
            access_token:accessToken,
            refresh_token:refreshToken,
            token_type:hash.get('token_type')||'bearer',
            expires_in:expiresIn,
            expires_at:Math.floor(Date.now()/1000)+expiresIn,
            user
          };
          localStorage.setItem('compassu_session',JSON.stringify(session));
          history.replaceState({},document.title,window.location.pathname);
          setReady(true);
          return;
        }

        setReady(Boolean(getSession()?.access_token));
      }catch(e){
        setError(e.message||'Unable to open this password reset link.');
        setReady(false);
      }
    };
    initialize();
  },[]);

  async function confirmRecovery(){
    setBusy(true);setError('');setMessage('');
    try{
      if(!pendingTokenHash)throw new Error('This password reset link is missing its verification token. Request a new reset link and try again.');
      const response=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{
        method:'POST',
        headers:baseHeaders,
        body:JSON.stringify({token_hash:pendingTokenHash,type:'recovery'})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.msg||body?.error_description||body?.message||'This password reset link is invalid or has expired.');
      if(!body?.access_token)throw new Error('Password recovery could not be completed. Request a new reset link and try again.');

      let user=body.user||null;
      if(!user){
        const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${body.access_token}`}
        });
        if(!userResponse.ok)throw new Error('Unable to open your password reset session.');
        user=await userResponse.json();
      }

      const expiresIn=Number(body.expires_in||3600);
      const session={
        access_token:body.access_token,
        refresh_token:body.refresh_token||'',
        token_type:body.token_type||'bearer',
        expires_in:expiresIn,
        expires_at:Number(body.expires_at||Math.floor(Date.now()/1000)+expiresIn),
        user
      };
      localStorage.setItem('compassu_session',JSON.stringify(session));
      sessionStorage.removeItem('compassu_confirmation_reloaded');
      history.replaceState({},document.title,window.location.pathname);
      setPendingTokenHash('');
      setReady(true);
    }catch(e){
      setError(e.message||'Unable to verify this password reset request.');
    }finally{setBusy(false)}
  }

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

      let confirmationSent=false;
      try{
        const confirmResponse=await fetch(`${SUPABASE_URL}/functions/v1/password-change-confirmation`,{
          method:'POST',
          headers:{...baseHeaders,Authorization:`Bearer ${session.access_token}`},
          body:'{}'
        });
        confirmationSent=confirmResponse.ok;
      }catch(error){
        console.error('CompassU password confirmation email failed',error);
      }

      localStorage.removeItem('compassu_session');
      setPassword('');setConfirmPassword('');setReady(false);
      setMessage(confirmationSent
        ?'Your CompassU password has been updated successfully. A confirmation email has also been sent to your account email address. You can now return to CompassU and log in with your new password.'
        :'Your CompassU password has been updated successfully. You can now return to CompassU and log in with your new password.');
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
      </>:pendingTokenHash?<>
        <p className="muted">For your security, password reset links are not activated until you confirm the request here. This prevents email security scanners from using the one-time link before you do.</p>
        {error&&<div className="error">{error}</div>}
        <button className="btn primary wide" disabled={busy} onClick={confirmRecovery}>{busy?'Verifying…':'Continue to Password Reset'}</button>
        <div style={{marginTop:14,textAlign:'center'}}><a href="/forgot-password" className="muted">Request a different reset link</a></div>
      </>:ready?<>
        <p className="muted">Choose a new password for your CompassU account.</p>
        <div className="field"><label>New password</label><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></div>
        <div className="field"><label>Confirm new password</label><input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!busy)updatePassword()}}/></div>
        {error&&<div className="error">{error}</div>}
        <button className="btn primary wide" disabled={busy} onClick={updatePassword}>{busy?'Updating…':'Update Password'}</button>
      </>:<>
        {error&&<div className="error">{error}</div>}
        {!error&&<div className="error">This password reset session is missing or has expired.</div>}
        <a className="btn primary wide" href="/forgot-password">Request a New Reset Link</a>
      </>}
    </div></div>
  </div>;
}
