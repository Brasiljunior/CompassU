'use client';

import {useEffect,useState} from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const baseHeaders={apikey:SUPABASE_KEY,'Content-Type':'application/json'};
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};

export default function AdminInvitationAcceptPage(){
  const[token,setToken]=useState(''),[session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');

  useEffect(()=>{const q=new URLSearchParams(window.location.search);setToken(q.get('token')||'');setSession(readSession())},[]);

  async function login(){
    setBusy(true);setError('');setNotice('');
    try{
      const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:baseHeaders,body:JSON.stringify({email,password})});
      const b=await r.json();if(!r.ok)throw new Error(b.error_description||b.msg||'Login failed');
      localStorage.setItem('compassu_session',JSON.stringify(b));setSession(b);setNotice('Signed in successfully. You can now accept the administrator invitation.');
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function accept(){
    if(!token)return setError('The administrator invitation link is missing its secure token.');
    if(!session?.access_token)return setError('Sign in before accepting the invitation.');
    setBusy(true);setError('');setNotice('');
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/accept_compassu_admin_invitation`,{method:'POST',headers:{...baseHeaders,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({p_token:token})});
      const b=await r.json().catch(()=>null);if(!r.ok)throw new Error(b?.message||b?.hint||'Unable to accept administrator invitation.');
      setNotice(typeof b==='string'?b:'Administrator access activated.');
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  function logout(){localStorage.removeItem('compassu_session');setSession(null);setNotice('');setError('')}

  return <div className="adminShell"><header className="adminTop"><a href="/" className="adminBrand">Compass<span>U</span></a><a href="/" className="btn ghost">Back to CompassU</a></header><main className="adminLoginWrap"><div className="adminLoginCard"><div className="adminKicker">STAGE 3C · ADMINISTRATOR INVITATION</div><h1>Accept Administrative Access</h1><p>This secure invitation activates only the organization or institution role assigned to your email address.</p>
    {!token&&<div className="error">This administrator invitation link is incomplete.</div>}
    {!session?<><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/><button className="btn primary wide" disabled={busy||!token} onClick={login}>{busy?'Signing in…':'Sign in to CompassU'}</button><div className="adminSecurityNote">Don't have a CompassU account yet? Use the main CompassU site to create your account with the exact email address that received this invitation, then return to this link.</div></>:<><div className="success">Signed in. Your account must match the invited email address.</div><button className="btn primary wide" disabled={busy||!token} onClick={accept}>{busy?'Activating…':'Accept Administrator Invitation'}</button><button className="btn ghost wide" onClick={logout}>Use a different account</button></>}
    {error&&<div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}
    {notice&&session&&<a href="/admin" className="btn primary wide">Open Administrator Dashboard</a>}
  </div></main></div>;
}
