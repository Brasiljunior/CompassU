'use client';

import { useEffect } from 'react';

export default function Admin50kConsoleRouter(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(rawUrl?.includes('/functions/v1/admin-console')){
          const secureUrl=rawUrl.replace('/functions/v1/admin-console','/functions/v1/admin-console-50k');
          return originalFetch(secureUrl,init);
        }
      }catch{}
      return originalFetch(input,init);
    };
    return()=>{window.fetch=originalFetch};
  },[]);
  return null;
}
