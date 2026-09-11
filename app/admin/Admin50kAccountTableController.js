'use client';

import {useEffect} from 'react';

const STATE_KEY='compassu_admin_50k_state';
const emailRegex=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const readState=()=>{try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')||{page:1,page_size:50,search:'',institution:''}}catch{return{page:1,page_size:50,search:'',institution:''}}};
const writeState=s=>{try{sessionStorage.setItem(STATE_KEY,JSON.stringify(s))}catch{}};
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const esc=v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export default function Admin50kAccountTableController(){
  useEffect(()=>{
    let observer,timer=null,busy=false,lastSignature='',institutions=[];

    const refreshDashboard=()=>{
      const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Refresh Dashboard'));
      if(button&&!button.disabled){button.click();return}
      window.dispatchEvent(new CustomEvent('compassu-admin-50k-refresh'));
    };

    const call=async(payload)=>{
      const session=readSession();
      if(!session?.access_token)throw new Error('Administrator login required.');
      const r=await fetch('/api/admin/console50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b?.error||'Administrator request failed.');
      return b;
    };

    const ensureCells=()=>{
      const table=document.querySelector('.adminTable');if(!table)return [];
      const head=table.querySelector('thead tr');
      if(head&&!head.querySelector('[data-compassu-institution-head]')){
        const first=head.querySelector('th');if(first){const th=document.createElement('th');th.textContent='Institution';th.dataset.compassuInstitutionHead='1';first.insertAdjacentElement('afterend',th)}
      }
      return [...table.querySelectorAll('tbody tr')].map(row=>{
        const match=String(row.textContent||'').match(emailRegex);
        const email=String(match?.[0]||'').trim().toLowerCase();
        let cell=row.querySelector('[data-compassu-institution-cell]');
        if(!cell){const first=row.querySelector('td');if(first){cell=document.createElement('td');cell.dataset.compassuInstitutionCell='1';first.insertAdjacentElement('afterend',cell)}}
        return {row,email,cell};
      }).filter(x=>x.email&&x.cell);
    };

    const renderFilter=()=>{
      const actions=document.querySelector('.adminAccounts .adminPanelActions');if(!actions)return;
      let select=document.getElementById('compassu-institution-filter');
      if(!select){
        select=document.createElement('select');select.id='compassu-institution-filter';select.className='adminSearch';select.setAttribute('aria-label','Filter accounts by institution');select.style.minWidth='210px';actions.insertAdjacentElement('afterbegin',select);
        select.addEventListener('change',()=>{const next={...readState(),page:1,institution:String(select.value||'')};writeState(next);lastSignature='';refreshDashboard()});
      }
      const state=readState();
      const markup='<option value="">All institutions</option>'+institutions.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
      if(select.innerHTML!==markup)select.innerHTML=markup;
      select.value=institutions.includes(state.institution)?state.institution:'';
    };

    const loadInstitutions=async()=>{
      try{
        const b=await call({action:'institution_list'});
        const next=Array.isArray(b?.institutions)?b.institutions.filter(Boolean):[];
        if(JSON.stringify(next)!==JSON.stringify(institutions)){institutions=next;renderFilter()}
      }catch(error){console.error('CompassU institution list load failed',error)}
    };

    const paintRows=async()=>{
      if(busy)return;
      const rows=ensureCells();if(!rows.length)return;
      renderFilter();
      const state=readState();
      const signature=[state.page,state.page_size,state.search,state.institution,rows.map(x=>x.email).join('|')].join('::');
      if(signature===lastSignature&&rows.every(x=>x.cell.textContent?.trim()&&x.cell.textContent.trim()!=='—'))return;
      busy=true;
      try{
        // Use the exact same server-side paged dataset that drives the account table.
        // This prevents drift between filtering/counts and the institution value painted on each row.
        const page=await call({action:'account_page',page:state.page||1,page_size:state.page_size||50,search:state.search||'',institution:state.institution||''});
        const users=Array.isArray(page?.users)?page.users:[];
        const byEmail=new Map(users.map(u=>[String(u?.email||'').trim().toLowerCase(),String(u?.institution||'').trim()]));
        for(const item of rows)item.cell.textContent=byEmail.get(item.email)||'—';
        lastSignature=signature;
      }catch(error){console.error('CompassU institution row load failed',error)}finally{busy=false}
    };

    const run=()=>{clearTimeout(timer);timer=setTimeout(()=>{renderFilter();paintRows()},100)};
    observer=new MutationObserver(run);observer.observe(document.body,{childList:true,subtree:true});
    const updated=()=>{lastSignature='';loadInstitutions();run()};
    window.addEventListener('compassu:institutions-updated',updated);
    loadInstitutions();run();
    const interval=setInterval(()=>{loadInstitutions();run()},1500);
    return()=>{clearTimeout(timer);clearInterval(interval);observer?.disconnect();window.removeEventListener('compassu:institutions-updated',updated)};
  },[]);
  return null;
}
