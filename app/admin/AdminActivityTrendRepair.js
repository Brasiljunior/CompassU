'use client';

import { useEffect } from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const dayKey=value=>{if(!value)return'';const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)};

function buildTrend(users){
  const days=[];
  const today=new Date();today.setUTCHours(0,0,0,0);
  for(let offset=29;offset>=0;offset--){
    const d=new Date(today);d.setUTCDate(today.getUTCDate()-offset);
    days.push({date:d.toISOString().slice(0,10),new_accounts:0,completed_surveys:0});
  }
  const byDate=new Map(days.map(d=>[d.date,d]));
  for(const user of users||[]){
    const created=dayKey(user?.created_at);
    if(byDate.has(created))byDate.get(created).new_accounts+=1;
    const completed=dayKey(user?.last_completed_at);
    if(byDate.has(completed))byDate.get(completed).completed_surveys+=Number(user?.completed_surveys||0)>0?1:0;
  }
  return days;
}

export default function AdminActivityTrendRepair(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const response=await originalFetch(input,init);
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(!rawUrl?.includes('/functions/v1/admin-console')||!init?.body||!response.ok)return response;
        const request=JSON.parse(init.body);
        if(request?.action!=='overview')return response;
        const body=await response.clone().json();
        if(Array.isArray(body?.trend)&&body.trend.length===30)return response;

        let users=Array.isArray(body?.users)?body.users:[];
        // The overview user rows are the authoritative source already used by the dashboard.
        // If they are absent, preserve the server response rather than exposing any broader query.
        if(!users.length)return response;
        const repaired={...body,trend:buildTrend(users)};
        return new Response(JSON.stringify(repaired),{status:response.status,statusText:response.statusText,headers:response.headers});
      }catch{return response}
    };
    return()=>{window.fetch=originalFetch};
  },[]);
  return null;
}
