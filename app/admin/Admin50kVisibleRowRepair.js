'use client';

import {useEffect} from 'react';

const emailRegex=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};

export default function Admin50kVisibleRowRepair(){
  useEffect(()=>{
    let stopped=false;
    let timer=null;
    let requestInFlight=false;
    let lastSignature='';
    let lastMap={};

    const visibleRows=()=>[...document.querySelectorAll('.adminTable tbody tr')];
    const emailForRow=row=>String(row?.textContent||'').match(emailRegex)?.[0]?.trim().toLowerCase()||'';

    function formatAccountCell(row,email){
      const cells=[...row.querySelectorAll('td')];
      const accountCell=cells.find(td=>String(td.textContent||'').toLowerCase().includes(email));
      if(!accountCell)return;
      const name=accountCell.querySelector('b');
      if(name){name.style.display='block';name.style.marginBottom='4px';name.style.lineHeight='1.25'}
      const emailNode=[...accountCell.querySelectorAll('span,small')].find(el=>String(el.textContent||'').trim().toLowerCase()===email);
      if(emailNode){emailNode.style.display='block';emailNode.style.lineHeight='1.3';emailNode.style.overflowWrap='anywhere'}
    }

    function institutionCell(row){
      let cell=row.querySelector('[data-compassu-institution-cell]');
      if(cell)return cell;
      const table=row.closest('table');
      const headers=[...table?.querySelectorAll('thead th')||[]];
      const index=headers.findIndex(th=>String(th.textContent||'').trim().toLowerCase()==='institution');
      if(index>=0){cell=row.querySelectorAll('td')[index];if(cell){cell.dataset.compassuInstitutionCell='1';return cell}}
      const first=row.querySelector('td');
      if(!first)return null;
      cell=document.createElement('td');
      cell.dataset.compassuInstitutionCell='1';
      first.insertAdjacentElement('afterend',cell);
      return cell;
    }

    function paint(map=lastMap){
      for(const row of visibleRows()){
        const email=emailForRow(row);if(!email)continue;
        formatAccountCell(row,email);
        const cell=institutionCell(row);if(!cell)continue;
        const institution=String(map[email]||'').trim();
        const desired=institution||'—';
        if(cell.textContent!==desired)cell.textContent=desired;
        if(institution)cell.dataset.serverInstitution='1';
      }
    }

    async function refresh(force=false){
      if(stopped||requestInFlight)return;
      const session=readSession();if(!session?.access_token)return;
      const rows=visibleRows();
      const emails=[...new Set(rows.map(emailForRow).filter(Boolean))];
      paint();
      if(!emails.length)return;
      const signature=emails.join('|');
      if(!force&&signature===lastSignature&&Object.keys(lastMap).length){paint();return}
      requestInFlight=true;
      try{
        const response=await fetch('/api/admin/institution-lookup50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({emails}),cache:'no-store'});
        const body=await response.json().catch(()=>({}));
        if(response.ok){lastMap=body?.institutions||{};lastSignature=signature;paint(lastMap)}
      }catch{}finally{requestInFlight=false}
    }

    const schedule=(force=false)=>{clearTimeout(timer);timer=setTimeout(()=>refresh(force),50)};
    const observer=new MutationObserver(()=>schedule(false));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    const onInstitutions=()=>schedule(true);
    window.addEventListener('compassu:institutions-updated',onInstitutions);
    const interval=setInterval(()=>{paint();refresh(false)},750);
    schedule(true);
    return()=>{stopped=true;clearTimeout(timer);clearInterval(interval);observer.disconnect();window.removeEventListener('compassu:institutions-updated',onInstitutions)};
  },[]);
  return null;
}
