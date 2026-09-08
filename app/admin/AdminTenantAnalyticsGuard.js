'use client';

import {useEffect} from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||['sb','publishable','lWtjaYYRk4hd1Bb-yKG3eA','CxF4CW9-'].join('_');
const tenantRoles=new Set(['system_admin','institution_admin','counselor']);
const scopedRpcs=['get_institutional_analytics_v2','get_institutional_trends','get_institutional_comparison'];

export default function AdminTenantAnalyticsGuard(){
 useEffect(()=>{
  const originalFetch=window.fetch.bind(window);let cachedToken='';let cachedContext=[];
  async function contextFor(auth){const token=String(auth||'').replace(/^Bearer\s+/i,'');if(!token)return[];if(token===cachedToken)return cachedContext;const r=await originalFetch(`${SUPABASE_URL}/rest/v1/rpc/get_compassu_admin_context`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});if(!r.ok)return[];const rows=await r.json();cachedToken=token;cachedContext=Array.isArray(rows)?rows:[];return cachedContext}
  window.fetch=async(input,init={})=>{
   const raw=typeof input==='string'?input:input?.url||'';const headers=new Headers(init?.headers||{});const auth=headers.get('Authorization');if(!auth)return originalFetch(input,init);
   const isInstitutionList=raw.includes('/rest/v1/account_institutions?');const rpc=scopedRpcs.find(name=>raw.includes(`/rest/v1/rpc/${name}`));if(!isInstitutionList&&!rpc)return originalFetch(input,init);
   try{
    const ctx=await contextFor(auth);if(ctx.some(x=>x.role==='master_admin'))return originalFetch(input,init);const tenant=ctx.filter(x=>tenantRoles.has(x.role));if(!tenant.length)return originalFetch(input,init);
    const system=tenant.filter(x=>x.role==='system_admin');const institutionRows=tenant.filter(x=>x.tenant_institution_id);
    const allowedNames=[...new Set(institutionRows.map(x=>x.institution_name).filter(Boolean))];
    if(isInstitutionList){const rows=allowedNames.map(institution=>({institution}));return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}})}
    if(rpc==='get_institutional_comparison'&&!system.length){return new Response(JSON.stringify({message:'Cross-institution comparison requires System/District Administrator access.'}),{status:403,headers:{'Content-Type':'application/json'}})}
    if(system.length)return originalFetch(input,init);
    if(!allowedNames.length)return new Response(JSON.stringify({message:'No active institution scope is assigned to this administrator.'}),{status:403,headers:{'Content-Type':'application/json'}});
    let body={};try{body=JSON.parse(String(init?.body||'{}'))}catch{}
    if(rpc==='get_institutional_analytics_v2'||rpc==='get_institutional_trends'){
      const requested=String(body.p_institution||'').trim();if(requested&& !allowedNames.includes(requested))return new Response(JSON.stringify({message:'This administrator is not authorized for the requested institution.'}),{status:403,headers:{'Content-Type':'application/json'}});
      body.p_institution=requested||allowedNames[0];return originalFetch(input,{...init,body:JSON.stringify(body)});
    }
    return originalFetch(input,init);
   }catch{return originalFetch(input,init)}
  };
  return()=>{window.fetch=originalFetch};
 },[]);return null;
}
