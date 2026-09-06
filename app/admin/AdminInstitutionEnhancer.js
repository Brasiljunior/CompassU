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
function htmlEscape(v){
  return String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

export default function AdminInstitutionEnhancer(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let overviewUsers=[];
    let individualInstitution='';
    let batchInstitutionByEmail={};
    let filterValue='';
    let scheduled=false;

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
        rows.forEach(row=>{if(row?.email)cache[String(row.email).toLowerCase()]=normalize(row.institution)});
        writeCache(cache);
        return cache;
      }catch{return readCache()}
    }

    async function saveInstitution(email,institution){
      email=String(email||'').trim().toLowerCase();
      institution=normalize(institution);
      if(!email)return false;
      const cache=readCache();
      cache[email]=institution;
      writeCache(cache);
      const session=readSession();
      if(!session?.access_token)return false;
      try{
        const response=await originalFetch(`${SUPABASE_URL}/rest/v1/account_institutions`,{
          method:'POST',
          headers:{
            apikey:SUPABASE_KEY,
            Authorization:`Bearer ${session.access_token}`,
            'Content-Type':'application/json',
            Prefer:'resolution=merge-duplicates,return=minimal'
          },
          body:JSON.stringify({email,institution,updated_at:new Date().toISOString()})
        });
        return response.ok;
      }catch(error){console.error('CompassU institution assignment could not be persisted',error);return false}
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
          scheduleEnhance();
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
      if(!panel||document.getElementById('compassu-institution-input'))return false;
      const emailInput=[...panel.querySelectorAll('input')].find(el=>el.type==='email');
      if(!emailInput)return false;
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
      if(batchText){
        const next='Upload an Excel or CSV file with First Name, Last Name, Email, and Institution columns. Nothing is sent until you review and confirm.';
        if(batchText.textContent!==next)batchText.textContent=next;
      }
      return true;
    }

    function getEmailForRow(row){return row.querySelector('td:first-child span')?.textContent?.trim().toLowerCase()||''}
    function getInstitutionForRow(row){
      const email=getEmailForRow(row);
      const user=overviewUsers.find(u=>String(u.email||'').toLowerCase()===email);
      return normalize(user?.institution)||'—';
    }

    function applyFilter(){
      document.querySelectorAll('.adminTable tbody tr').forEach(row=>{
        const institution=normalize(row.querySelector('[data-compassu-institution-cell]')?.textContent);
        const nextDisplay=!filterValue||institution===filterValue?'':'none';
        if(row.style.display!==nextDisplay)row.style.display=nextDisplay;
      });
    }

    function closeEditModal(){document.getElementById('compassu-account-edit-modal')?.remove()}
    function openEditModal(row){
      closeEditModal();
      const email=getEmailForRow(row);
      if(!email)return;
      const user=overviewUsers.find(u=>String(u.email||'').toLowerCase()===email)||{};
      const displayName=[user.first_name,user.last_name].filter(Boolean).join(' ')||row.querySelector('td:first-child b')?.textContent?.trim()||'Account';
      const currentInstitution=normalize(user.institution);

      const backdrop=document.createElement('div');
      backdrop.id='compassu-account-edit-modal';
      backdrop.className='adminModalBackdrop';
      const modal=document.createElement('div');
      modal.className='adminModal';
      modal.innerHTML=`<div class="adminPanelHead"><div><div class="adminKicker">EDIT ACCOUNT INFORMATION</div><h2>${htmlEscape(displayName)}</h2><p>${htmlEscape(email)}</p></div><button class="btn ghost" type="button" data-edit-close>Close</button></div><div class="detailSection"><label for="compassu-edit-institution">Institution</label><input id="compassu-edit-institution" placeholder="High school, college, or university" value="${htmlEscape(currentInstitution)}"><p class="muted">Institution is optional. Leave it blank if this account is not associated with a client institution.</p></div><div class="detailActions"><button class="btn primary" type="button" data-edit-save>Save Changes</button><button class="btn ghost" type="button" data-edit-cancel>Cancel</button></div><div data-edit-status></div>`;
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeEditModal()});
      modal.querySelector('[data-edit-close]').addEventListener('click',closeEditModal);
      modal.querySelector('[data-edit-cancel]').addEventListener('click',closeEditModal);
      modal.querySelector('[data-edit-save]').addEventListener('click',async()=>{
        const saveButton=modal.querySelector('[data-edit-save]');
        const status=modal.querySelector('[data-edit-status]');
        const institution=normalize(modal.querySelector('#compassu-edit-institution').value);
        saveButton.disabled=true;
        saveButton.textContent='Saving…';
        status.textContent='';
        const ok=await saveInstitution(email,institution);
        if(!ok){
          saveButton.disabled=false;
          saveButton.textContent='Save Changes';
          status.className='error adminNotice';
          status.textContent='Unable to save the account update. Please try again.';
          return;
        }
        overviewUsers=overviewUsers.map(u=>String(u.email||'').toLowerCase()===email?{...u,institution}:u);
        scheduleEnhance();
        closeEditModal();
      });
    }

    function enhanceTable(){
      const table=document.querySelector('.adminTable');
      if(!table)return false;
      let changed=false;
      const headerRow=table.querySelector('thead tr');
      const firstHeader=headerRow?.querySelector('th');
      if(firstHeader&&!headerRow.querySelector('[data-compassu-institution-head]')){
        const th=document.createElement('th');
        th.textContent='Institution';
        th.dataset.compassuInstitutionHead='1';
        firstHeader.insertAdjacentElement('afterend',th);
        changed=true;
      }
      table.querySelectorAll('tbody tr').forEach(row=>{
        const firstCell=row.querySelector('td');
        let td=row.querySelector('[data-compassu-institution-cell]');
        if(firstCell&&!td){
          td=document.createElement('td');
          td.dataset.compassuInstitutionCell='1';
          firstCell.insertAdjacentElement('afterend',td);
          changed=true;
        }
        if(td){
          const nextValue=getInstitutionForRow(row);
          if(td.textContent!==nextValue){td.textContent=nextValue;changed=true}
        }
        const actions=row.querySelector('.adminRowActions');
        if(actions&&!actions.querySelector('[data-compassu-edit-account]')){
          const edit=document.createElement('button');
          edit.type='button';
          edit.textContent='Edit';
          edit.dataset.compassuEditAccount='1';
          edit.addEventListener('click',()=>openEditModal(row));
          actions.insertAdjacentElement('afterbegin',edit);
          changed=true;
        }
      });
      applyFilter();
      return changed;
    }

    function enhanceFilter(){
      const actions=document.querySelector('.adminAccounts .adminPanelActions');
      if(!actions)return false;
      let changed=false;
      let select=document.getElementById('compassu-institution-filter');
      if(!select){
        select=document.createElement('select');
        select.id='compassu-institution-filter';
        select.className='adminSearch';
        select.setAttribute('aria-label','Filter accounts by institution');
        select.style.minWidth='210px';
        select.addEventListener('change',()=>{filterValue=select.value;applyFilter()});
        actions.insertAdjacentElement('afterbegin',select);
        changed=true;
      }
      const institutions=[...new Set(overviewUsers.map(u=>normalize(u.institution)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      const optionMarkup='<option value="">All institutions</option>'+institutions.map(v=>`<option value="${htmlEscape(v)}">${htmlEscape(v)}</option>`).join('');
      if(select.innerHTML!==optionMarkup){
        const previous=filterValue;
        select.innerHTML=optionMarkup;
        if(institutions.includes(previous))select.value=previous;else{filterValue='';select.value=''}
        changed=true;
      }
      return changed;
    }

    function enhanceDashboard(){
      enhanceInvitePanel();
      enhanceFilter();
      enhanceTable();
    }
    function scheduleEnhance(){
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;enhanceDashboard()});
    }

    const fileListener=e=>{
      const input=e.target;
      if(input?.matches?.('input[type="file"][accept*=".csv"]'))captureBatchFile(input.files?.[0]);
    };
    document.addEventListener('change',fileListener,true);

    const observer=new MutationObserver(()=>scheduleEnhance());
    observer.observe(document.body,{childList:true,subtree:true});
    scheduleEnhance();

    return()=>{
      window.fetch=originalFetch;
      observer.disconnect();
      document.removeEventListener('change',fileListener,true);
      closeEditModal();
    };
  },[]);
  return null;
}
