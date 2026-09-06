'use client';

import { useEffect } from 'react';

const SUPABASE_URL='https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=['sb','publishable','lWtjaYYRk4hd1Bb-yKG3eA','CxF4CW9-'].join('_');

export default function AdminSupabaseFetchGuard(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=(input,init={})=>{
      try{
        const raw=typeof input==='string'?input:input?.url;
        if(raw&&raw.startsWith('undefined/')){
          const corrected=`${SUPABASE_URL}/${raw.replace(/^undefined\//,'')}`;
          const headers=new Headers(init?.headers||{});
          headers.set('apikey',SUPABASE_KEY);
          return originalFetch(corrected,{...init,headers});
        }
      }catch(error){console.error('CompassU administrator request repair failed',error)}
      return originalFetch(input,init);
    };
    return()=>{window.fetch=originalFetch};
  },[]);
  return null;
}
