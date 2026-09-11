'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Public Supabase browser credentials. Preview deployments may not inherit
// production-scoped Vercel variables, so use the same safe publishable fallback
// already used by CompassU's existing browser authentication flows.
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const readStored=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};

export default function AdminMfaGate({children}){
  const clientRef=useRef(null);
  const [session,setSession]=useState(null);
  const [status,setStatus]=useState('checking');
  const [factor,setFactor]=useState(null);
  const [challengeId,setChallengeId]=useState('');
  const [qr,setQr]=useState('');
  const [secret,setSecret]=useState('');
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    clientRef.current=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    let last='';
    const sync=async()=>{
      const stored=readStored();
      const token=stored?.access_token||'';
      if(token===last)return;
      last=token;
      if(!stored?.access_token||!stored?.refresh_token){setSession(null);setStatus('signed_out');setFactor(null);setChallengeId('');setQr('');setSecret('');return}
      setStatus('checking');setError('');setSession(stored);
      try{
        const {error:setErr}=await clientRef.current.auth.setSession({access_token:stored.access_token,refresh_token:stored.refresh_token});
        if(setErr)throw setErr;
        const {data:aal,error:aalErr}=await clientRef.current.auth.mfa.getAuthenticatorAssuranceLevel();
        if(aalErr)throw aalErr;
        if(aal?.currentLevel==='aal2'){setStatus('verified');return}
        const {data:factors,error:fErr}=await clientRef.current.auth.mfa.listFactors();
        if(fErr)throw fErr;
        const verified=[...(factors?.totp||[]),...(factors?.phone||[])].find(f=>f.status==='verified');
        if(verified){setFactor(verified);setStatus('challenge');return}
        const {data:enrolled,error:eErr}=await clientRef.current.auth.mfa.enroll({factorType:'totp',friendlyName:'CompassU Administrator'});
        if(eErr)throw eErr;
        setFactor(enrolled);
        setQr(enrolled?.totp?.qr_code||'');
        setSecret(enrolled?.totp?.secret||'');
        setStatus('enroll');
      }catch(e){setStatus('error');setError(e?.message||'Unable to initialize administrator MFA.')}
    };
    sync();
    const timer=setInterval(sync,400);
    return()=>clearInterval(timer);
  },[]);

  const signOut=()=>{localStorage.removeItem('compassu_session');window.location.href='/admin'};

  const verify=async()=>{
    if(!factor?.id||!code.trim())return;
    setBusy(true);setError('');
    try{
      let cid=challengeId;
      if(!cid){
        const {data,error}=await clientRef.current.auth.mfa.challenge({factorId:factor.id});
        if(error)throw error;
        cid=data?.id||'';
        setChallengeId(cid);
      }
      const {error:vErr}=await clientRef.current.auth.mfa.verify({factorId:factor.id,challengeId:cid,code:code.trim()});
      if(vErr)throw vErr;
      const {data:sData,error:sErr}=await clientRef.current.auth.getSession();
      if(sErr)throw sErr;
      if(!sData?.session)throw new Error('MFA verification succeeded but a refreshed session was not returned.');
      const merged={...session,...sData.session,user:sData.session.user||session?.user};
      localStorage.setItem('compassu_session',JSON.stringify(merged));
      setSession(merged);setStatus('verified');setCode('');setChallengeId('');
      window.location.reload();
    }catch(e){setChallengeId('');setError(e?.message||'The verification code could not be confirmed.')}finally{setBusy(false)}
  };

  if(status==='signed_out')return children;
  if(status==='verified')return children;
  if(status==='checking')return <MfaShell><p>Checking administrator security…</p></MfaShell>;
  if(status==='error')return <MfaShell><h1>Administrator Security</h1><p>{error}</p><button className="btn primary" onClick={signOut}>Return to sign in</button></MfaShell>;

  return <MfaShell>
    <div className="adminKicker">ADMINISTRATOR SECURITY</div>
    <h1>{status==='enroll'?'Set up multi-factor authentication':'Verify multi-factor authentication'}</h1>
    <p>{status==='enroll'?'CompassU administrators must use a second factor. Scan this code in an authenticator app, then enter the six-digit code.':'Enter the six-digit code from your authenticator app to continue to the CompassU administrator dashboard.'}</p>
    {status==='enroll'&&qr&&<img src={qr} alt="CompassU administrator MFA QR code" style={{maxWidth:220,width:'100%',margin:'14px auto',display:'block'}}/>}
    {status==='enroll'&&secret&&<details><summary>Can’t scan the QR code?</summary><code style={{display:'block',wordBreak:'break-all',marginTop:8}}>{secret}</code></details>}
    <label style={{display:'block',marginTop:18,fontWeight:700}}>Verification code</label>
    <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} onKeyDown={e=>e.key==='Enter'&&verify()} placeholder="123456" style={{width:'100%',marginTop:8}}/>
    {error&&<div className="error" style={{marginTop:12}}>{error}</div>}
    <button className="btn primary wide" disabled={busy||code.length<6} onClick={verify} style={{marginTop:14}}>{busy?'Verifying…':'Verify and continue'}</button>
    <button className="btn ghost wide" onClick={signOut} style={{marginTop:8}}>Cancel and sign out</button>
  </MfaShell>;
}

function MfaShell({children}){return <div className="adminShell"><main className="adminLoginWrap"><div className="adminLoginCard">{children}</div></main></div>}
