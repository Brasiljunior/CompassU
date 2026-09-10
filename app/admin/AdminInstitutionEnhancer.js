'use client';

import { useEffect } from 'react';

const CACHE_KEY='compassu_admin_institutions';
const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const cleanHeader=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
const normalize=v=>String(v||'').trim();

function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}}catch{return{}}}
function writeCache(cache){try{localStorage.setItem(CACHE_KEY,JSON.stringify(cache))}catch{}}
function readSession(){try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}}
function htmlEscape(v){return String(v).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')}

export default function AdminInstitutionEnhancer(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let overviewUsers=[];
    let institutionCache=readCache();
    let individualInstitution='';
    let batchInstitutionByEmail={};
    let filterValue='';
    let scheduled=false;
    let loadedToken='';

    async function loadPersistentInstitutions(){
      const session=readSession();
      if(!session?.access_token)return institutionCache;
      try{
        const response=await originalFetch(`${SUPABASE_URL}/rest/v1/account_institutions?select=email,institution`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}});
        if(!response.ok)return institutionCache;
        const rows=await response.json();
        const next={...institutionCache};
        rows.forEach(row=>{if(row?.email)next[String(row.email).trim().toLowerCase()]=normalize(row.institution)});
        institutionCache=next;
        writeCache(next);
        const savedEmails=new Set(rows.map(row=>String(row?.email||'').trim().toLowerCase()).filter(Boolean));
        const missing=Object.entries(institutionCache)
          .filter(([email,institution])=>email&&normalize(institution)&&!savedEmails.has(email))
          .map(([email,institution])=>({email,institution:normalize(institution)}));
        if(missing.length)await saveInstitutions(missing);
        return next;
      }catch{return institutionCache}
    }

    async function saveInstitutions(assignments,{allowBlank=false}={}){
      const session=readSession();
      if(!session?.access_token)return false;
      const rows=[...new Map((assignments||[]).map(item=>{
        const email=String(item?.email||'').trim().toLowerCase();
        const institution=normalize(item?.institution);
        return[email,{email,institution,updated_at:new Date().toISOString()}];
      }).filter(([email,row])=>email&&(allowBlank||row.institution))).values()];
      if(!rows.length)return true;
      try{
        const response=await originalFetch(`${SUPABASE_URL}/rest/v1/account_institutions?on_conflict=email`,{
          method:'POST',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
          body:JSON.stringify(rows)
        });
        return response.ok;
      }catch(error){console.error('CompassU institution assignments could not be persisted',error);return false}
    }

    async function syncPersistentInstitutions(){
      const session=readSession();
      const token=session?.access_token||'';
      if(!token||token===loadedToken)return;
      loadedToken=token;
      await loadPersistentInstitutions();
      overviewUsers=overviewUsers.map(user=>({...user,institution:normalize(user.institution||institutionCache[String(user.email||'').toLowerCase()])}));
      scheduleEnhance();
    }

    async function saveInstitution(email,institution){
      email=String(email||'').trim().toLowerCase();
      institution=normalize(institution);
      if(!email)return false;
      institutionCache={...institutionCache,[email]:institution};
      writeCache(institutionCache);
      return saveInstitutions([{email,institution}],{allowBlank:true});
    }

    window.fetch=async(input,init)=>{
      let nextInit=init,action='',requestEmail='',requestInstitution='',batchAssignments=[];
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(rawUrl?.includes('/functions/v1/admin-console')&&init?.body){
          const payload=JSON.parse(init.body);
          action=payload?.action||'';
          requestEmail=String(payload?.email||'').trim().toLowerCase();
          if(action==='invite_user'){
            requestInstitution=normalize(payload.institution||batchInstitutionByEmail[requestEmail]||individualInstitution||institutionCache[requestEmail]);
            if(requestInstitution){payload.institution=requestInstitution;nextInit={...init,body:JSON.stringify(payload)}}
          }
        }else if(rawUrl?.includes('/functions/v1/admin-batch-invite')&&init?.body){
          const payload=JSON.parse(init.body);
          batchAssignments=(payload?.people||[]).map(person=>{
            const email=String(person?.email||'').trim().toLowerCase();
            return{email,institution:normalize(person?.institution||batchInstitutionByEmail[email]||institutionCache[email])};
          }).filter(item=>item.email&&item.institution);
        }
      }catch{}
      const response=await originalFetch(input,nextInit);
      try{
        if(action==='invite_user'&&response.ok&&requestEmail&&requestInstitution)await saveInstitution(requestEmail,requestInstitution);
        if(batchAssignments.length&&response.ok)await saveInstitutions(batchAssignments);
        if(action==='overview'&&response.ok){
          const body=await response.clone().json();
          await loadPersistentInstitutions();
          overviewUsers=(body?.users||[]).map(user=>({...user,institution:normalize(user?.institution||user?.profile?.institution||user?.user_metadata?.institution||institutionCache[String(user?.email||'').toLowerCase()])}));
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
        const map={},next={...institutionCache};
        rows.forEach(row=>{
          const mapped={};Object.entries(row).forEach(([k,v])=>mapped[cleanHeader(k)]=v);
          const email=String(mapped.email||mapped.emailaddress||'').trim().toLowerCase();
          const institution=normalize(mapped.institution||mapped.school||mapped.college||mapped.organization);
          if(email&&institution){map[email]=institution;next[email]=institution}
        });
        batchInstitutionByEmail=map;institutionCache=next;writeCache(next);scheduleEnhance();
      }catch(error){console.error('CompassU institution column could not be read',error)}
    }

    function enhanceInvitePanel(){
      const panel=[...document.querySelectorAll('.adminPanel')].find(el=>el.querySelector('h2')?.textContent?.includes('Add / Assist Account'));
      if(!panel||document.getElementById('compassu-institution-input'))return false;
      const emailInput=[...panel.querySelectorAll('input')].find(el=>el.type==='email');
      if(!emailInput)return false;
      const label=document.createElement('label');label.id='compassu-institution-label';label.textContent='Institution';
      const institutionInput=document.createElement('input');institutionInput.id='compassu-institution-input';institutionInput.placeholder='High school, college, or university';institutionInput.setAttribute('autocomplete','organization');institutionInput.addEventListener('input',()=>{individualInstitution=institutionInput.value});
      emailInput.insertAdjacentElement('afterend',institutionInput);institutionInput.insertAdjacentElement('beforebegin',label);
      const batchText=[...panel.querySelectorAll('p')].find(p=>p.textContent?.includes('First Name, Last Name, and Email'));
      if(batchText)batchText.textContent='Upload an Excel or CSV file with First Name, Last Name, Email, and Institution columns. Nothing is sent until you review and confirm.';
      return true;
    }

    function getEmailForRow(row){return row.querySelector('td:first-child span')?.textContent?.trim().toLowerCase()||''}
    function getInstitutionForRow(row){
      const email=getEmailForRow(row);
      const user=overviewUsers.find(u=>String(u.email||'').toLowerCase()===email);
      return normalize(user?.institution||institutionCache[email])||'—';
    }
    function allInstitutions(){return [...new Set([...overviewUsers.map(u=>normalize(u.institution)),...Object.values(institutionCache).map(normalize)].filter(Boolean))].sort((a,b)=>a.localeCompare(b))}

    function applyFilter(){document.querySelectorAll('.adminTable tbody tr').forEach(row=>{const institution=normalize(row.querySelector('[data-compassu-institution-cell]')?.textContent);row.style.display=!filterValue||institution===filterValue?'':'none'})}
    function closeEditModal(){document.getElementById('compassu-account-edit-modal')?.remove()}

    function openEditModal(row){
      closeEditModal();
      const email=getEmailForRow(row);if(!email)return;
      const user=overviewUsers.find(u=>String(u.email||'').toLowerCase()===email)||{};
      const displayName=[user.first_name,user.last_name].filter(Boolean).join(' ')||row.querySelector('td:first-child b')?.textContent?.trim()||'Account';
      const currentInstitution=normalize(user.institution||institutionCache[email]);
      const backdrop=document.createElement('div');backdrop.id='compassu-account-edit-modal';backdrop.className='adminModalBackdrop';
      const modal=document.createElement('div');modal.className='adminModal';
      modal.innerHTML=`<div class="adminPanelHead"><div><div class="adminKicker">EDIT ACCOUNT INFORMATION</div><h2>${htmlEscape(displayName)}</h2><p>${htmlEscape(email)}</p></div><button class="btn ghost" type="button" data-edit-close>Close</button></div><div class="detailSection"><label for="compassu-edit-institution">Institution</label><input id="compassu-edit-institution" placeholder="High school, college, or university" value="${htmlEscape(currentInstitution)}"><p class="muted">Institution is optional. Leave it blank if this account is not associated with a client institution.</p></div><div class="detailActions"><button class="btn primary" type="button" data-edit-save>Save Changes</button><button class="btn ghost" type="button" data-edit-cancel>Cancel</button></div><div data-edit-status></div>`;
      backdrop.appendChild(modal);document.body.appendChild(backdrop);
      backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeEditModal()});modal.querySelector('[data-edit-close]').addEventListener('click',closeEditModal);modal.querySelector('[data-edit-cancel]').addEventListener('click',closeEditModal);
      modal.querySelector('[data-edit-save]').addEventListener('click',async()=>{
        const saveButton=modal.querySelector('[data-edit-save]'),status=modal.querySelector('[data-edit-status]'),institution=normalize(modal.querySelector('#compassu-edit-institution').value);
        saveButton.disabled=true;saveButton.textContent='Saving…';status.textContent='';
        const ok=await saveInstitution(email,institution);
        if(!ok){saveButton.disabled=false;saveButton.textContent='Save Changes';status.className='error adminNotice';status.textContent='Unable to save the account update. Please try again.';return}
        overviewUsers=overviewUsers.map(u=>String(u.email||'').toLowerCase()===email?{...u,institution}:u);scheduleEnhance();closeEditModal();
      });
    }

    function enhanceTable(){
      const table=document.querySelector('.adminTable');if(!table)return false;let changed=false;
      const headerRow=table.querySelector('thead tr'),firstHeader=headerRow?.querySelector('th');
      if(firstHeader&&!headerRow.querySelector('[data-compassu-institution-head]')){const th=document.createElement('th');th.textContent='Institution';th.dataset.compassuInstitutionHead='1';firstHeader.insertAdjacentElement('afterend',th);changed=true}
      table.querySelectorAll('tbody tr').forEach(row=>{
        const firstCell=row.querySelector('td');let td=row.querySelector('[data-compassu-institution-cell]');
        if(firstCell&&!td){td=document.createElement('td');td.dataset.compassuInstitutionCell='1';firstCell.insertAdjacentElement('afterend',td);changed=true}
        if(td){const nextValue=getInstitutionForRow(row);if(td.textContent!==nextValue){td.textContent=nextValue;changed=true}}
        const actions=row.querySelector('.adminRowActions');
        if(actions&&!actions.querySelector('[data-compassu-edit-account]')){const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.dataset.compassuEditAccount='1';edit.addEventListener('click',()=>openEditModal(row));actions.insertAdjacentElement('afterbegin',edit);changed=true}
      });applyFilter();return changed;
    }

    function enhanceFilter(){
      const actions=document.querySelector('.adminAccounts .adminPanelActions');if(!actions)return false;let changed=false;let select=document.getElementById('compassu-institution-filter');
      if(!select){select=document.createElement('select');select.id='compassu-institution-filter';select.className='adminSearch';select.setAttribute('aria-label','Filter accounts by institution');select.style.minWidth='210px';select.addEventListener('change',()=>{filterValue=select.value;applyFilter()});actions.insertAdjacentElement('afterbegin',select);changed=true}
      const institutions=allInstitutions(),optionMarkup='<option value="">All institutions</option>'+institutions.map(v=>`<option value="${htmlEscape(v)}">${htmlEscape(v)}</option>`).join('');
      if(select.innerHTML!==optionMarkup){const previous=filterValue;select.innerHTML=optionMarkup;if(institutions.includes(previous))select.value=previous;else{filterValue='';select.value=''}changed=true}return changed;
    }

    function enhanceDashboard(){enhanceInvitePanel();enhanceFilter();enhanceTable()}
    function scheduleEnhance(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhanceDashboard()})}

    const fileListener=e=>{const input=e.target;if(input?.matches?.('input[type="file"][accept*=".csv"]'))captureBatchFile(input.files?.[0])};
    document.addEventListener('change',fileListener,true);
    const observer=new MutationObserver(()=>scheduleEnhance());observer.observe(document.body,{childList:true,subtree:true});
    scheduleEnhance();syncPersistentInstitutions();
    const sessionTimer=setInterval(syncPersistentInstitutions,500);

    return()=>{window.fetch=originalFetch;observer.disconnect();clearInterval(sessionTimer);document.removeEventListener('change',fileListener,true);closeEditModal()};
  },[]);
  return null;
}
