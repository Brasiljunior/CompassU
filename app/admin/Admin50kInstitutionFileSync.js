'use client';

import { useEffect } from 'react';

const CACHE_KEY='compassu_admin_institutions';
const cleanHeader=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const readCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}}catch{return{}}};
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());

function institutionFromMapped(mapped){
  const direct=['institution','school','highschool','highschoolname','schoolname','college','collegename','university','universityname','organization','organizationname'];
  for(const key of direct){const value=String(mapped?.[key]||'').trim();if(value)return value;}
  for(const [key,value] of Object.entries(mapped||{})){
    if(/institution|school|college|university|organization/.test(key)){
      const text=String(value||'').trim();if(text)return text;
    }
  }
  return '';
}

export default function Admin50kInstitutionFileSync(){
  useEffect(()=>{
    let busy=false;

    const refreshDashboard=()=>{
      const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Refresh Dashboard'));
      if(button&&!button.disabled)setTimeout(()=>button.click(),250);
    };

    const showNotice=(text,isError=false)=>{
      const root=document.querySelector('.batch500Root')||document.querySelector('.adminBatch')||document.querySelector('.adminMain');
      if(!root)return;
      const notice=document.createElement('div');notice.className=isError?'error adminNotice':'success adminNotice';notice.textContent=text;root.prepend(notice);setTimeout(()=>notice.remove(),9000);
    };

    const syncAssignments=async(assignments,{silent=false}={})=>{
      const session=readSession();if(!session?.access_token||busy)return null;
      const deduped=[...new Map((assignments||[]).map(item=>{
        const email=String(item?.email||'').trim().toLowerCase();
        const institution=String(item?.institution||'').trim();
        return[email,{email,institution}];
      }).filter(([email,row])=>validEmail(email)&&row.institution)).values()];
      if(!deduped.length)return {synced:0};
      busy=true;
      try{
        let synced=0;
        for(let i=0;i<deduped.length;i+=500){
          const chunk=deduped.slice(i,i+500);
          const r=await fetch('/api/admin/institution-sync50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({assignments:chunk})});
          const b=await r.json().catch(()=>({}));
          if(!r.ok)throw new Error(b?.error||'Unable to sync institution associations.');
          synced+=Number(b?.synced||0);
        }
        window.dispatchEvent(new CustomEvent('compassu:institutions-updated'));
        if(!silent)showNotice(`Institution associations synchronized for ${synced} account${synced===1?'':'s'}.`);
        refreshDashboard();
        return {synced};
      }catch(error){
        console.error('CompassU institution sync failed',error);
        if(!silent)showNotice(error?.message||'Unable to sync institution associations.',true);
        return null;
      }finally{busy=false}
    };

    const recoverCachedAssociations=async()=>{
      const cache=readCache();
      const assignments=Object.entries(cache).map(([email,institution])=>({email,institution})).filter(x=>validEmail(x.email)&&String(x.institution||'').trim());
      if(assignments.length)await syncAssignments(assignments,{silent:true});
    };

    const onChange=async event=>{
      const input=event.target;
      if(busy||!input?.matches?.('input[type="file"]'))return;
      const file=input.files?.[0];if(!file||!/(\.xlsx|\.xls|\.csv)$/i.test(file.name))return;
      try{
        const XLSX=await import('xlsx');
        const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const raw=XLSX.utils.sheet_to_json(ws,{defval:''});
        const assignments=[];
        for(const row of raw){
          const mapped={};Object.entries(row).forEach(([k,v])=>mapped[cleanHeader(k)]=v);
          const email=String(mapped.email||mapped.emailaddress||mapped.studentemail||'').trim().toLowerCase();
          const institution=institutionFromMapped(mapped);
          if(validEmail(email)&&institution)assignments.push({email,institution});
        }
        if(!assignments.length){showNotice('No Institution/School column with account associations was found in this file.',true);return;}
        await syncAssignments(assignments);
      }catch(error){showNotice(error?.message||'Unable to read institution associations from this file.',true)}
    };

    document.addEventListener('change',onChange,true);
    const timer=setTimeout(recoverCachedAssociations,1200);
    return()=>{clearTimeout(timer);document.removeEventListener('change',onChange,true)};
  },[]);
  return null;
}
