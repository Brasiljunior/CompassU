'use client';

import {useEffect} from 'react';

const STATE_KEY='compassu_admin_50k_state';
const emailRegex=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const readState=()=>{try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')||{page:1,page_size:50,search:'',institution:''}}catch{return{page:1,page_size:50,search:'',institution:''}}};
const writeState=s=>{try{sessionStorage.setItem(STATE_KEY,JSON.stringify(s))}catch{}};
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const esc=v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const isAdminConsole=url=>url?.includes('/functions/v1/admin-console')||url?.includes('/api/admin/console50k');

export default function Admin50kInstitutionBridge(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let currentUsers=[];
    let institutions=[];
    let scheduled=false;

    const refreshDashboard=()=>{
      const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Refresh Dashboard'));
      if(button&&!button.disabled){button.click();return}
      window.dispatchEvent(new CustomEvent('compassu-admin-50k-refresh'));
    };

    const ensureStructure=()=>{
      const table=document.querySelector('.adminTable');
      if(!table)return [];
      const head=table.querySelector('thead tr');
      if(head&&!head.querySelector('[data-compassu-institution-head]')){
        const first=head.querySelector('th');
        if(first){const th=document.createElement('th');th.textContent='Institution';th.dataset.compassuInstitutionHead='1';first.insertAdjacentElement('afterend',th)}
      }
      return [...table.querySelectorAll('tbody tr')].map(row=>{
        const email=String((String(row.textContent||'').match(emailRegex)||[])[0]||'').trim().toLowerCase();
        let cell=row.querySelector('[data-compassu-institution-cell]');
        if(!cell){const first=row.querySelector('td');if(first){cell=document.createElement('td');cell.dataset.compassuInstitutionCell='1';first.insertAdjacentElement('afterend',cell)}}
        return {email,cell};
      }).filter(x=>x.email&&x.cell);
    };

    const paintRows=()=>{
      const rows=ensureStructure();
      if(!rows.length)return;
      const byEmail=new Map(currentUsers.map(u=>[String(u?.email||'').trim().toLowerCase(),String(u?.institution||'').trim()]));
      let cache={};try{cache=JSON.parse(localStorage.getItem('compassu_admin_institutions')||'{}')||{}}catch{}
      for(const item of rows){
        const value=byEmail.get(item.email)||String(cache[item.email]||'').trim();
        item.cell.textContent=value||'—';
      }
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
        const r=await originalFetch('/api/admin/console50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'institution_list'})});
        const b=await r.json().catch(()=>({}));
        if(r.ok){institutions=Array.isArray(b?.institutions)?b.institutions.filter(Boolean):[];renderFilter()}
      }catch{}
    };

    window.fetch=async(input,init)=>{
      const rawUrl=typeof input==='string'?input:input?.url;
      let action='';
      try{if(isAdminConsole(rawUrl)&&init?.body)action=JSON.parse(init.body)?.action||''}catch{}
      const response=await originalFetch(input,init);
      try{
        if(isAdminConsole(rawUrl)&&response.ok&&(action==='overview'||action==='refresh')){
          const body=await response.clone().json();
          currentUsers=Array.isArray(body?.users)?body.users:[];
          schedule();
        }
      }catch{}
      return response;
    };

    const enhance=()=>{renderFilter();paintRows()};
    function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}
    const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
    const updated=()=>{loadInstitutions();schedule()};
    window.addEventListener('compassu:institutions-updated',updated);
    loadInstitutions();schedule();
    const interval=setInterval(()=>{paintRows()},1000);
    return()=>{window.fetch=originalFetch;observer.disconnect();clearInterval(interval);window.removeEventListener('compassu:institutions-updated',updated)};
  },[]);
  return null;
}
