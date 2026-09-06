'use client';

import { useEffect } from 'react';

const CACHE_KEY='compassu_admin_institutions';
const cleanHeader=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
const normalize=v=>String(v||'').trim();

function readCache(){
  try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}}catch{return{}}
}
function writeCache(cache){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}
}

export default function AdminInstitutionEnhancer(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let overviewUsers=[];
    let individualInstitution='';
    let batchInstitutionByEmail={};
    let filterValue='';

    window.fetch=async(input,init)=>{
      let nextInit=init;
      let action='';
      let requestEmail='';
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(rawUrl?.includes('/functions/v1/admin-console')&&init?.body){
          const payload=JSON.parse(init.body);
          action=payload?.action||'';
          requestEmail=String(payload?.email||'').trim().toLowerCase();
          if(action==='invite_user'){
            const cached=readCache();
            const institution=normalize(payload.institution||batchInstitutionByEmail[requestEmail]||individualInstitution||cached[requestEmail]);
            if(institution){
              payload.institution=institution;
              cached[requestEmail]=institution;
              writeCache(cached);
              nextInit={...init,body:JSON.stringify(payload)};
            }
          }
        }
      }catch{}

      const response=await originalFetch(input,nextInit);
      try{
        if(action==='overview'&&response.ok){
          const body=await response.clone().json();
          const cache=readCache();
          overviewUsers=(body?.users||[]).map(user=>({
            ...user,
            institution:normalize(user?.institution||user?.profile?.institution||user?.user_metadata?.institution||cache[String(user?.email||'').toLowerCase()])
          }));
          setTimeout(enhanceDashboard,0);
        }
      }catch{}
      return response;
    };

    async function captureBatchFile(file){
      if(!file)return;
      try{
        const XLSX=await import('xlsx');
        const buf=await file.arrayBuffer();
        const wb=XLSX.read(buf,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
        const map={};
        const cache=readCache();
        rows.forEach(row=>{
          const mapped={};
          Object.entries(row).forEach(([k,v])=>mapped[cleanHeader(k)]=v);
          const email=String(mapped.email||mapped.emailaddress||'').trim().toLowerCase();
          const institution=normalize(mapped.institution||mapped.school||mapped.college||mapped.organization);
          if(email&&institution){map[email]=institution;cache[email]=institution}
        });
        batchInstitutionByEmail=map;
        writeCache(cache);
      }catch(error){
        console.error('CompassU institution column could not be read',error);
      }
    }

    function enhanceInvitePanel(){
      const panel=[...document.querySelectorAll('.adminPanel')].find(el=>el.querySelector('h2')?.textContent?.includes('Add / Assist Account'));
      if(!panel||document.getElementById('compassu-institution-input'))return;
      const emailInput=[...panel.querySelectorAll('input')].find(el=>el.type==='email');
      if(!emailInput)return;
      const label=document.createElement('label');
      label.id='compassu-institution-label';
      label.textContent='Institution';
      const input=document.createElement('input');
      input.id='compassu-institution-input';
      input.placeholder='High school, college, or university';
      input.autocomplete='organization';
      input.addEventListener('input',()=>{individualInstitution=input.value});
      emailInput.insertAdjacentElement('afterend',input);
      input.insertAdjacentElement('beforebegin',label);

      const batchText=[...panel.querySelectorAll('p')].find(p=>p.textContent?.includes('First Name, Last Name, and Email'));
      if(batchText)batchText.textContent='Upload an Excel or CSV file with First Name, Last Name, Email, and Institution columns. Nothing is sent until you review and confirm.';
    }

    function getInstitutionForRow(row){
      const email=row.querySelector('td:first-child span')?.textContent?.trim().toLowerCase()||'';
      const user=overviewUsers.find(u=>String(u.email||'').toLowerCase()===email);
      return normalize(user?.institution)||'—';
    }

    function applyFilter(){
      const rows=document.querySelectorAll('.adminTable tbody tr');
      rows.forEach(row=>{
        const institutionCell=row.querySelector('[data-compassu-institution-cell]');
        const institution=normalize(institutionCell?.textContent);
        const matches=!filterValue||institution===filterValue;
        row.style.display=matches?'':'none';
      });
    }

    function enhanceTable(){
      const table=document.querySelector('.adminTable');
      if(!table)return;
      const headerRow=table.querySelector('thead tr');
      const firstHeader=headerRow?.querySelector('th');
      if(firstHeader&&!headerRow.querySelector('[data-compassu-institution-head]')){
        const th=document.createElement('th');
        th.textContent='Institution';
        th.dataset.compassuInstitutionHead='1';
        firstHeader.insertAdjacentElement('afterend',th);
      }
      table.querySelectorAll('tbody tr').forEach(row=>{
        const firstCell=row.querySelector('td');
        if(firstCell&&!row.querySelector('[data-compassu-institution-cell]')){
          const td=document.createElement('td');
          td.dataset.compassuInstitutionCell='1';
          td.textContent=getInstitutionForRow(row);
          firstCell.insertAdjacentElement('afterend',td);
        }else{
          const td=row.querySelector('[data-compassu-institution-cell]');
          if(td)td.textContent=getInstitutionForRow(row);
        }
      });
      applyFilter();
    }

    function enhanceFilter(){
      const actions=document.querySelector('.adminAccounts .adminPanelActions');
      if(!actions||document.getElementById('compassu-institution-filter'))return;
      const select=document.createElement('select');
      select.id='compassu-institution-filter';
      select.className='adminSearch';
      select.setAttribute('aria-label','Filter accounts by institution');
      select.style.minWidth='210px';
      const institutions=[...new Set(overviewUsers.map(u=>normalize(u.institution)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      select.innerHTML='<option value="">All institutions</option>'+institutions.map(v=>`<option value="${v.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}">${v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</option>`).join('');
      select.value=filterValue;
      select.addEventListener('change',()=>{filterValue=select.value;applyFilter()});
      actions.insertAdjacentElement('afterbegin',select);
    }

    function enhanceDashboard(){
      enhanceInvitePanel();
      enhanceFilter();
      enhanceTable();
    }

    const fileListener=e=>{
      const input=e.target;
      if(input?.matches?.('input[type="file"][accept*=".csv"]'))captureBatchFile(input.files?.[0]);
    };
    document.addEventListener('change',fileListener,true);

    const observer=new MutationObserver(()=>enhanceDashboard());
    observer.observe(document.body,{childList:true,subtree:true});
    enhanceDashboard();

    return()=>{
      window.fetch=originalFetch;
      observer.disconnect();
      document.removeEventListener('change',fileListener,true);
    };
  },[]);
  return null;
}
