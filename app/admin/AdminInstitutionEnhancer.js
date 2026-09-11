'use client';

import {useEffect} from 'react';

const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const normalize=v=>String(v||'').trim();
const htmlEscape=v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export default function AdminInstitutionEnhancer(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let individualInstitution='';
    let scheduled=false;

    async function saveInstitution(email,institution){
      const session=readSession();
      email=String(email||'').trim().toLowerCase();
      institution=normalize(institution);
      if(!session?.access_token||!email)return false;
      try{
        const r=await originalFetch('/api/admin/institution-sync50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({assignments:[{email,institution}]})});
        if(r.ok){window.dispatchEvent(new CustomEvent('compassu:institutions-updated'));window.dispatchEvent(new CustomEvent('compassu-admin-50k-refresh'))}
        return r.ok;
      }catch{return false}
    }

    window.fetch=async(input,init)=>{
      let nextInit=init;
      let email='';
      let institution='';
      let isInvite=false;
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        const isAdmin=rawUrl?.includes('/functions/v1/admin-console')||rawUrl?.includes('/api/admin/console50k');
        if(isAdmin&&init?.body){
          const payload=JSON.parse(init.body);
          if(payload?.action==='invite_user'){
            isInvite=true;
            email=String(payload?.email||'').trim().toLowerCase();
            institution=normalize(payload?.institution||individualInstitution);
            if(institution){payload.institution=institution;nextInit={...init,body:JSON.stringify(payload)}}
          }
        }
      }catch{}
      const response=await originalFetch(input,nextInit);
      if(isInvite&&response.ok&&email&&institution)await saveInstitution(email,institution);
      return response;
    };

    function enhanceInvitePanel(){
      const panel=[...document.querySelectorAll('.adminPanel')].find(el=>el.querySelector('h2')?.textContent?.includes('Add / Assist Account'));
      if(!panel||document.getElementById('compassu-institution-input'))return;
      const emailInput=[...panel.querySelectorAll('input')].find(el=>el.type==='email');
      if(!emailInput)return;
      const label=document.createElement('label');label.id='compassu-institution-label';label.textContent='Institution';
      const input=document.createElement('input');input.id='compassu-institution-input';input.placeholder='High school, college, or university';input.setAttribute('autocomplete','organization');
      input.addEventListener('input',()=>{individualInstitution=input.value});
      emailInput.insertAdjacentElement('afterend',input);input.insertAdjacentElement('beforebegin',label);
    }

    function closeModal(){document.getElementById('compassu-account-edit-modal')?.remove()}
    function openModal(row){
      closeModal();
      const email=String(row?.dataset?.compassuAccountEmail||'').trim().toLowerCase();
      if(!email)return;
      const current=normalize(row.querySelector('[data-compassu-institution-cell]')?.textContent);
      const name=normalize(row.querySelector('[data-compassu-name-cell] b')?.textContent)||'Account';
      const backdrop=document.createElement('div');backdrop.id='compassu-account-edit-modal';backdrop.className='adminModalBackdrop';
      const modal=document.createElement('div');modal.className='adminModal';modal.innerHTML=`<div class="adminPanelHead"><div><div class="adminKicker">EDIT ACCOUNT INFORMATION</div><h2>${htmlEscape(name)}</h2><p>${htmlEscape(email)}</p></div><button class="btn ghost" type="button" data-close>Close</button></div><div class="detailSection"><label for="compassu-edit-institution">Institution</label><input id="compassu-edit-institution" placeholder="High school, college, or university" value="${htmlEscape(current==='—'?'':current)}"></div><div class="detailActions"><button class="btn primary" type="button" data-save>Save Changes</button><button class="btn ghost" type="button" data-cancel>Cancel</button></div><div data-status></div>`;
      backdrop.appendChild(modal);document.body.appendChild(backdrop);
      const close=()=>closeModal();backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});modal.querySelector('[data-close]').addEventListener('click',close);modal.querySelector('[data-cancel]').addEventListener('click',close);
      modal.querySelector('[data-save]').addEventListener('click',async()=>{const btn=modal.querySelector('[data-save]'),status=modal.querySelector('[data-status]'),institution=normalize(modal.querySelector('#compassu-edit-institution').value);btn.disabled=true;btn.textContent='Saving…';const ok=await saveInstitution(email,institution);if(ok){close();return}btn.disabled=false;btn.textContent='Save Changes';status.className='error adminNotice';status.textContent='Unable to save the account update. Please try again.'});
    }

    function enhanceEditButtons(){
      document.querySelectorAll('.adminTable tbody tr').forEach(row=>{
        const actions=row.querySelector('.adminRowActions');
        if(!actions||actions.querySelector('[data-compassu-edit-account]')||!row.dataset.compassuAccountEmail)return;
        const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.dataset.compassuEditAccount='1';edit.addEventListener('click',()=>openModal(row));actions.insertAdjacentElement('afterbegin',edit);
      });
    }

    function enhance(){enhanceInvitePanel();enhanceEditButtons()}
    function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}
    const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});schedule();
    return()=>{window.fetch=originalFetch;observer.disconnect();closeModal()};
  },[]);
  return null;
}
