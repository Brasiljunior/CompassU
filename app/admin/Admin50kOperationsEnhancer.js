'use client';

import { useEffect } from 'react';

const STATE_KEY='compassu_admin_50k_state';
const readState=()=>{try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')||{page:1,page_size:50,search:'',institution:''}}catch{return{page:1,page_size:50,search:'',institution:''}}};
const writeState=s=>{try{sessionStorage.setItem(STATE_KEY,JSON.stringify(s))}catch{}};
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const esc=v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export default function Admin50kOperationsEnhancer(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let institutions=[];
    let loadingInstitutions=false;
    let scheduled=false;

    // Prevent the legacy enhancer from downloading the entire account-to-institution table.
    // Current-page institution values now arrive from the server-side account page RPC.
    window.fetch=async(input,init)=>{
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        const method=String(init?.method||'GET').toUpperCase();
        if(method==='GET'&&rawUrl?.includes('/rest/v1/account_institutions?select=email,institution')){
          return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
        }
      }catch{}
      return originalFetch(input,init);
    };

    const callAdmin=async payload=>{
      const session=readSession();
      if(!session?.access_token)throw new Error('Administrator login required.');
      const r=await originalFetch('/api/admin/console50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok){let b={};try{b=await r.json()}catch{};throw new Error(b?.error||'Administrator request failed.')}return r;
    };

    const refreshDashboard=()=>{
      const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Refresh Dashboard'));
      if(button&&!button.disabled)button.click();
    };

    async function ensureInstitutions(){
      if(institutions.length||loadingInstitutions||!readSession()?.access_token)return;
      loadingInstitutions=true;
      try{
        const r=await callAdmin({action:'institution_list'});
        const b=await r.json();
        institutions=Array.isArray(b?.institutions)?b.institutions:[];
        schedule();
      }catch{}finally{loadingInstitutions=false}
    }

    function enhanceInstitutionFilter(){
      const select=document.getElementById('compassu-institution-filter');
      if(!select)return;
      const state=readState();
      const markup='<option value="">All institutions</option>'+institutions.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
      if(institutions.length&&select.innerHTML!==markup){select.innerHTML=markup;select.value=institutions.includes(state.institution)?state.institution:''}
      if(!select.dataset.server50k){
        select.dataset.server50k='1';
        select.addEventListener('change',()=>{
          const next={...readState(),page:1,institution:String(select.value||'')};
          writeState(next);
          refreshDashboard();
        },true);
      }
    }

    function enhanceExport(){
      const button=[...document.querySelectorAll('.adminPanelActions button')].find(b=>b.textContent?.trim()==='Export CSV');
      if(!button||button.dataset.server50k)return;
      button.dataset.server50k='1';
      button.title='Export the full matching account population, not only the visible page.';
      button.addEventListener('click',async event=>{
        event.preventDefault();event.stopPropagation();
        button.disabled=true;const previous=button.textContent;button.textContent='Preparing export…';
        try{
          const state=readState();
          const r=await callAdmin({action:'export_accounts',search:state.search||'',institution:state.institution||''});
          const blob=await r.blob();
          const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='CompassU-Admin-Accounts.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
        }catch(e){window.alert(e?.message||'Unable to export accounts.')}finally{button.disabled=false;button.textContent=previous}
      },true);
    }

    function enhance(){ensureInstitutions();enhanceInstitutionFilter();enhanceExport()}
    function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}
    const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
    schedule();
    const timer=setInterval(()=>{ensureInstitutions();schedule()},1000);
    return()=>{window.fetch=originalFetch;observer.disconnect();clearInterval(timer)};
  },[]);
  return null;
}
