'use client';

import { useEffect } from 'react';

const CACHE_KEY='compassu_admin_institutions';
const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const cleanHeader=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
const normalize=v=>String(v||'').trim();

function readCache(){
  try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}}catch{return{}}
}
function writeCache(cache){
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}
}
function readSession(){
  try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}
}

export default function AdminInstitutionEnhancer(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let overviewUsers=[];
    let individualInstitution='';
    let batchInstitutionByEmail={};
    let filterValue='';

    async function loadPersistentInstitutions(){
      const session=readSession();
      if(!session?.access_token)return readCache();
      try{
        const response=await originalFetch(`${SUPABASE_URL}/rest/v1/account_institutions?select=email,institution`,{
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}
        });
        if(!response.ok)return readCache();
        const rows=await response.json();
        const cache=readCache();
        rows.forEach(row=>{if(row?.email&&row?.institution)cache[String(row.email).toLowerCase()]=normalize(row.institution)});
        writeCache(cache);
        return cache;
      }catch{return readCache()}
    }

    async function saveInstitution(email,institution){
      email=String(email||'').trim().toLowerCase();
      institution=normalize(institution);
      if(!email||!institution)return;
      const cache=readCache();
      cache[email]=institution;
      writeCache(cache);
      const session=readSession();
      if(!session?.access_token)return;
      try{
        await originalFetch(`${SUPABASE_URL}/rest/v1/account_institutions`,{
          method:'POST',
          headers:{
            apikey:SUPABASE_KEY,
            Authorization:`Bearer ${session.access_token}`,
            'Content-Type':'application/json',
            Prefer:'resolution=merge-duplicates,return=minimal'
          },
          body:JSON.stringify({email,institution})
        });
      }catch(error){console.error('CompassU institution assignment could not be persisted',error)}
    }

    window.fetch=async(input,init)=>{
      let nextInit=init;
      let action='';
      let requestEmail='';
      let requestInstitution='';
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(rawUrl?.includes('/functions/v1/admin-console')&&init?.body){
          const payload=JSON.parse(init.body);
          action=payload?.action||'';
          requestEmail=String(payload?.email||'').trim().toLowerCase();
          if(action==='invite_user'){
            const cached=readCache();
            requestInstitution=normalize(payload.institution||batchInstitutionByEmail[requestEmail]||individualInstitution||cached[requestEmail]);
            if(requestInstitution){
              payload.institution=requestInstitution;
              nextInit={...init,body:JSON.stringify(payload)};
            }
          }
        }
      }catch{}

      const response=await originalFetch(input,nextInit);
      try{
        if(action==='invite_user'&&response.ok&&requestEmail&&requestInstitution){
          await saveInstitution(requestEmail,requestInstitution);
        }
        if(action==='overview'&&response.ok){
          const body=await response.clone().json();
          const persistent=await loadPersistentInstitutions();
          overviewUsers=(body?.users||[]).map(user=>({
            ...user,
            institution:normalize(user?.institution||user?.profile?.institution||user?.user_metadata?.institution||persistent[String(user?.email||'').toLowerCase()])
          }));
          refreshDashboard();
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
      const institutionInput=document.createElement('input');
      institutionInput.id='compassu-institution-input';
      institutionInput.placeholder='High school, college, or university';
      institutionInput.setAttribute('autocomplete','organization');
      institutionInput.addEventListener('input',()=>{individualInstitution=institutionInput.value});
      emailInput.insertAdjacentElement('afterend',institutionInput);
      institutionInput.insertAdjacentElement('beforebegin',label);

      const batchText=[...panel.querySelectorAll('p')].find(p=>p.textContent?.includes('First Name, Last Name, and Email'));
      if(batchText)batchText.textContent='Upload an Excel or CSV file with First Name, Last Name, Email, and Institution columns. Nothing is sent until you review and confirm.';
    }

    function getInstitutionForRow(row){
      const email=row.querySelector('td:first-child span')?.textContent?.trim().toLowerCase()||'';
      const user=overviewUsers.find(u=>String(u.email||'').toLowerCase()===email);
      return normalize(user?.institution)||'—';
    }

    function applyFilter(){
      document.querySelectorAll('.adminTable tbody tr').forEach(row=>{
        const institution=normalize(row.querySelector('[data-compassu-institution-cell]')?.textContent);
        row.style.display=!filterValue||institution===filterValue?'':'none';
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
        let td=row.querySelector('[data-compassu-institution-cell]');
        if(firstCell&&!td){
          td=document.createElement('td');
          td.dataset.compassuInstitutionCell='1';
          firstCell.insertAdjacentElement('afterend',td);
        }
        if(td)td.textContent=getInstitutionForRow(row);
      });
      applyFilter();
    }

    function htmlEscape(v){return String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}

    function enhanceFilter(){
      const actions=document.querySelector('.adminAccounts .adminPanelActions');
      if(!actions)return;
      let select=document.getElementById('compassu-institution-filter');
      if(!select){
        select=document.createElement('select');
        select.id='compassu-institution-filter';
        select.className='adminSearch';
        select.setAttribute('aria-label','Filter accounts by institution');
        select.style.minWidth='210px';
        select.addEventListener('change',()=>{filterValue=select.value;applyFilter()});
        actions.insertAdjacentElement('afterbegin',select);
      }
      const institutions=[...new Set(overviewUsers.map(u=>normalize(u.institution)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      const previous=filterValue;
      select.innerHTML='<option value="">All institutions</option>'+institutions.map(v=>`<option value="${htmlEscape(v)}">${htmlEscape(v)}</option>`).join('');
      if(institutions.includes(previous))select.value=previous;else{filterValue='';select.value=''}
    }

    function enhanceDashboard(){
      enhanceInvitePanel();
      enhanceFilter();
      enhanceTable();
    }
    function refreshDashboard(){setTimeout(enhanceDashboard,0)}

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
