'use client';

import { useEffect } from 'react';

const cleanHeader=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};

export default function Admin50kInstitutionFileSync(){
  useEffect(()=>{
    let busy=false;
    const onChange=async event=>{
      const input=event.target;
      if(busy||!input?.matches?.('input[type="file"][accept*=".csv"]'))return;
      const file=input.files?.[0];if(!file)return;
      try{
        const XLSX=await import('xlsx');
        const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const raw=XLSX.utils.sheet_to_json(ws,{defval:''});
        const assignments=[];
        for(const row of raw){
          const mapped={};Object.entries(row).forEach(([k,v])=>mapped[cleanHeader(k)]=v);
          const email=String(mapped.email||mapped.emailaddress||'').trim().toLowerCase();
          const institution=String(mapped.institution||mapped.school||mapped.highschool||mapped.college||mapped.organization||'').trim();
          if(email&&institution)assignments.push({email,institution});
        }
        if(!assignments.length)return;
        const session=readSession();if(!session?.access_token)return;
        busy=true;
        const r=await fetch('/api/admin/institution-sync50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({assignments})});
        const b=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(b?.error||'Unable to sync institution associations.');
        window.dispatchEvent(new CustomEvent('compassu:institutions-updated'));
        const notice=document.createElement('div');notice.className='success adminNotice';notice.textContent=`Institution associations synchronized for ${Number(b.synced||0)} account${Number(b.synced||0)===1?'':'s'}. Refresh Dashboard to display them.`;
        const root=document.querySelector('.batch500Root')||document.querySelector('.adminBatch');root?.prepend(notice);
        setTimeout(()=>notice.remove(),7000);
      }catch(error){
        console.error('CompassU institution file sync failed',error);
      }finally{busy=false}
    };
    document.addEventListener('change',onChange,true);
    return()=>document.removeEventListener('change',onChange,true);
  },[]);
  return null;
}
