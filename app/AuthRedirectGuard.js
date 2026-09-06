'use client';

import { useEffect } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';

export default function AuthRedirectGuard(){
  useEffect(()=>{
    if(typeof window==='undefined')return;

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

    const query=new URLSearchParams(window.location.search);
    const queryType=query.get('type');
    const tokenHash=query.get('token_hash')||query.get('token');

    async function storeRecoverySession(sessionLike){
      const accessToken=sessionLike?.access_token;
      if(!accessToken)return false;
      const refreshToken=sessionLike?.refresh_token||'';
      let user=sessionLike?.user||null;
      if(!user){
        const userResponse=await originalFetch(`${SUPABASE_URL}/auth/v1/user`,{
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}
        });
        if(!userResponse.ok)return false;
        user=await userResponse.json();
      }
      const expiresIn=Number(sessionLike?.expires_in||3600);
      const session={
        access_token:accessToken,
        refresh_token:refreshToken,
        token_type:sessionLike?.token_type||'bearer',
        expires_in:expiresIn,
        expires_at:Number(sessionLike?.expires_at||Math.floor(Date.now()/1000)+expiresIn),
        user
      };
      localStorage.setItem('compassu_session',JSON.stringify(session));
      sessionStorage.removeItem('compassu_confirmation_reloaded');
      return true;
    }

    if(queryType==='recovery'&&tokenHash&&SUPABASE_URL&&SUPABASE_KEY){
      const verifyRecovery=async()=>{
        try{
          const response=await originalFetch(`${SUPABASE_URL}/auth/v1/verify`,{
            method:'POST',
            headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
            body:JSON.stringify({token_hash:tokenHash,type:'recovery'})
          });
          const body=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(body?.msg||body?.error_description||body?.message||'Unable to verify password recovery link');
          const stored=await storeRecoverySession(body);
          if(!stored)throw new Error('Password recovery session was not returned');
          history.replaceState({},document.title,window.location.pathname);
          window.location.replace('/reset-password');
        }catch(error){
          console.error('CompassU password recovery callback failed',error);
        }
      };
      verifyRecovery();
      return()=>{window.fetch=originalFetch};
    }

    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const accessToken=hash.get('access_token');
    const refreshToken=hash.get('refresh_token');
    const authType=hash.get('type');

    if(accessToken&&SUPABASE_URL&&SUPABASE_KEY){
      const finish=async()=>{
        try{
          const r=await originalFetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`}});
          if(!r.ok)throw new Error('Unable to complete authentication');
          const user=await r.json();
          const expiresIn=Number(hash.get('expires_in')||3600);
          const session={
            access_token:accessToken,
            refresh_token:refreshToken||'',
            token_type:hash.get('token_type')||'bearer',
            expires_in:expiresIn,
            expires_at:Math.floor(Date.now()/1000)+expiresIn,
            user
          };
          localStorage.setItem('compassu_session',JSON.stringify(session));
          history.replaceState({},document.title,window.location.pathname+window.location.search);

          if(authType==='recovery'){
            sessionStorage.removeItem('compassu_confirmation_reloaded');
            window.location.replace('/reset-password');
            return;
          }

          const metadata=user?.user_metadata||{};
          const needsInviteSetup=
            authType==='invite'||
            metadata.compassu_account_setup_required===true||
            metadata.compassu_account_setup_completed!==true;

          if(needsInviteSetup){
            sessionStorage.removeItem('compassu_confirmation_reloaded');
            if(window.location.pathname!=='/accept-invite'){
              window.location.replace('/accept-invite');
            }
            return;
          }

          if(!sessionStorage.getItem('compassu_confirmation_reloaded')){
            sessionStorage.setItem('compassu_confirmation_reloaded','1');
            window.location.replace('/');
          }
        }catch(error){
          console.error('CompassU authentication callback failed',error);
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
