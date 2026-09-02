'use client';

import { useEffect } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function AuthRedirectGuard(){
  useEffect(()=>{
    if(typeof window==='undefined')return;

    // Ensure email confirmations return to the exact CompassU environment
    // where the account was created (staging -> staging, production -> production).
    const originalFetch=window.fetch.bind(window);
    window.fetch=(input,init)=>{
      try{
        const raw=typeof input==='string'?input:input?.url;
        if(raw&&raw.includes('/auth/v1/signup')){
          const u=new URL(raw,window.location.origin);
          if(!u.searchParams.has('redirect_to'))u.searchParams.set('redirect_to',window.location.origin);
          if(typeof input==='string')return originalFetch(u.toString(),init);
          return originalFetch(new Request(u.toString(),input),init);
        }
      }catch{}
      return originalFetch(input,init);
    };

    // Supabase's implicit email-confirmation flow returns the authenticated
    // session in the URL fragment. Capture it, save the CompassU session,
    // remove tokens from the visible URL, and reload into the dashboard.
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    if(accessToken&&SUPABASE_URL&&SUPABASE_KEY){
      const finish=async()=>{
        try{
          const r=await originalFetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}});
          if(!r.ok)throw new Error('Unable to complete email confirmation');
          const user=await r.json();
          const session={
            access_token:accessToken,
            refresh_token:refreshToken||'',
            token_type:hash.get('token_type')||'bearer',
            expires_in:Number(hash.get('expires_in')||3600),
            expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600),
            user
          };
          localStorage.setItem('compassu_session',JSON.stringify(session));
          history.replaceState({},document.title,window.location.pathname+window.location.search);
          if(!sessionStorage.getItem('compassu_confirmation_reloaded')){
            sessionStorage.setItem('compassu_confirmation_reloaded','1');
            window.location.replace('/');
          }
        }catch(error){
          console.error('CompassU confirmation callback failed',error);
        }
      };
      finish();
    }else{
      sessionStorage.removeItem('compassu_confirmation_reloaded');
    }

    return()=>{window.fetch=originalFetch};
  },[]);
  return null;
}
