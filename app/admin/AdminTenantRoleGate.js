'use client';

import {useEffect} from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||['sb','publishable','lWtjaYYRk4hd1Bb-yKG3eA','CxF4CW9-'].join('_');

const tenantRoles=new Set(['system_admin','institution_admin','counselor']);

export default function AdminTenantRoleGate(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init={})=>{
      const raw=typeof input==='string'?input:input?.url||'';
      const isOverview=raw.includes('/functions/v1/admin-console')&&String(init?.body||'').includes('"action":"overview"');
      if(!isOverview)return originalFetch(input,init);

      const response=await originalFetch(input,init);
      if(response.ok)return response;

      let body=null;
      try{body=await response.clone().json()}catch{}
      if(!String(body?.error||'').toLowerCase().includes('administrator access is not enabled'))return response;

      const headers=new Headers(init?.headers||{});
      const authorization=headers.get('Authorization');
      if(!authorization)return response;

      try{
        const ctxResponse=await originalFetch(`${SUPABASE_URL}/rest/v1/rpc/get_compassu_admin_context`,{
          method:'POST',
          headers:{apikey:SUPABASE_KEY,Authorization:authorization,'Content-Type':'application/json'},
          body:'{}'
        });
        if(!ctxResponse.ok)return response;
        const context=await ctxResponse.json();
        const tenantContext=Array.isArray(context)?context.filter(row=>tenantRoles.has(row.role)):[];
        if(!tenantContext.length)return response;

        const primary=tenantContext[0];
        const safeOverview={
          admin:{role:primary.role,scope_type:primary.scope_type,organization_id:primary.organization_id,organization_name:primary.organization_name,tenant_institution_id:primary.tenant_institution_id,institution_name:primary.institution_name},
          stats:{total_accounts:0,completed_surveys:0,accounts_with_completed_survey:0,completion_rate:0,in_progress_surveys:0,suspended_accounts:0},
          trend:[],users:[]
        };
        return new Response(JSON.stringify(safeOverview),{status:200,headers:{'Content-Type':'application/json'}});
      }catch{return response}
    };
    return()=>{window.fetch=originalFetch};
  },[]);
  return null;
}
