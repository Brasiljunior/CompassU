'use client';

import {useEffect} from 'react';

const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const emailRegex=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export default function Admin50kInstitutionDisplayRepair(){
  useEffect(()=>{
    let timer=null,busy=false,lastKey='';

    const run=async()=>{
      if(busy)return;
      const rows=[...document.querySelectorAll('.adminTable tbody tr')];
      if(!rows.length)return;
      const rowEmails=rows.map(row=>{
        const match=String(row.textContent||'').match(emailRegex);
        return{row,email:String(match?.[0]||'').trim().toLowerCase()};
      }).filter(x=>x.email);
      if(!rowEmails.length)return;
      const key=rowEmails.map(x=>x.email).join('|');
      if(key===lastKey&&rowEmails.every(({row})=>{const td=row.querySelector('[data-compassu-institution-cell]');return td&&td.textContent?.trim()&&td.textContent.trim()!=='—'}))return;
      const session=readSession();if(!session?.access_token)return;
      busy=true;
      try{
        const r=await fetch('/api/admin/institution-lookup50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({emails:rowEmails.map(x=>x.email)})});
        const b=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(b?.error||'Unable to load institution associations.');
        const map=b?.institutions||{};
        for(const {row,email} of rowEmails){
          let td=row.querySelector('[data-compassu-institution-cell]');
          if(!td){const first=row.querySelector('td');if(first){td=document.createElement('td');td.dataset.compassuInstitutionCell='1';first.insertAdjacentElement('afterend',td)}}
          if(td)td.textContent=String(map[email]||'—');
        }
        lastKey=key;
      }catch(error){console.error('CompassU institution display repair failed',error)}finally{busy=false}
    };

    const schedule=()=>{clearTimeout(timer);timer=setTimeout(run,120)};
    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('compassu:institutions-updated',()=>{lastKey='';schedule()});
    schedule();
    return()=>{clearTimeout(timer);observer.disconnect()};
  },[]);
  return null;
}
