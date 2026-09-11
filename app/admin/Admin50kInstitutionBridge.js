'use client';

import {useEffect} from 'react';

const STATE_KEY='compassu_admin_50k_state';
const readState=()=>{try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')||{page:1,page_size:50,search:'',institution:''}}catch{return{page:1,page_size:50,search:'',institution:''}}};
const writeState=s=>{try{sessionStorage.setItem(STATE_KEY,JSON.stringify(s))}catch{}};
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const esc=v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export default function Admin50kInstitutionBridge(){
  useEffect(()=>{
    let institutions=[];
    let scheduled=false;

    const refreshDashboard=()=>{
      const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Refresh Dashboard'));
      if(button&&!button.disabled){button.click();return}
      window.dispatchEvent(new CustomEvent('compassu-admin-50k-refresh'));
    };

    const renderFilter=()=>{
      const actions=document.querySelector('.adminAccounts .adminPanelActions');
      if(!actions)return;
      let select=document.getElementById('compassu-institution-filter');
      if(!select){
        select=document.createElement('select');
        select.id='compassu-institution-filter';
        select.className='adminSearch';
        select.setAttribute('aria-label','Filter accounts by institution');
        select.style.minWidth='210px';
        actions.insertAdjacentElement('afterbegin',select);
        select.addEventListener('change',()=>{
          writeState({...readState(),page:1,institution:String(select.value||'')});
          refreshDashboard();
        });
      }
      const markup='<option value="">All institutions</option>'+institutions.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
      if(select.innerHTML!==markup)select.innerHTML=markup;
      const state=readState();
      select.value=institutions.includes(state.institution)?state.institution:'';
    };

    const loadInstitutions=async()=>{
      const session=readSession();if(!session?.access_token)return;
      try{
        const r=await fetch('/api/admin/console50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'institution_list'}),cache:'no-store'});
        const b=await r.json().catch(()=>({}));
        if(r.ok){institutions=Array.isArray(b?.institutions)?b.institutions.filter(Boolean):[];renderFilter()}
      }catch{}
    };

    const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderFilter()})};
    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true});
    const updated=()=>{loadInstitutions();schedule()};
    window.addEventListener('compassu:institutions-updated',updated);
    loadInstitutions();schedule();
    return()=>{observer.disconnect();window.removeEventListener('compassu:institutions-updated',updated)};
  },[]);
  return null;
}
