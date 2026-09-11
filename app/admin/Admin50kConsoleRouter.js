'use client';

import { useEffect } from 'react';

export default function Admin50kConsoleRouter(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(rawUrl?.includes('/functions/v1/admin-console')){
          return originalFetch('/api/admin/console50k',init);
        }
      }catch{}
      return originalFetch(input,init);
    };
    return()=>{window.fetch=originalFetch};
  },[]);
  return null;
}
