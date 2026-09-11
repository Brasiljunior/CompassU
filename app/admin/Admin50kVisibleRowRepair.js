'use client';

import {useEffect} from 'react';

const emailRegex=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const STATE_KEY='compassu_admin_50k_state';
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const readState=()=>{try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')||{page:1,page_size:50,search:'',institution:''}}catch{return{page:1,page_size:50,search:'',institution:''}}};

export default function Admin50kVisibleRowRepair(){
  useEffect(()=>{
    let stopped=false;
    let timer=null;
    let requestInFlight=false;
    let lastSignature='';
    let userMap=new Map();

    const table=()=>document.querySelector('.adminTable');
    const visibleRows=()=>[...document.querySelectorAll('.adminTable tbody tr')];
    const emailForRow=row=>String(row?.textContent||'').match(emailRegex)?.[0]?.trim().toLowerCase()||'';

    function ensureHeaders(){
      const head=table()?.querySelector('thead tr');
      if(!head)return;
      const headers=[...head.querySelectorAll('th')];
      if(!headers.length)return;

      const accountHeader=headers.find(th=>String(th.textContent||'').trim().toLowerCase()==='account');
      if(accountHeader&&!head.querySelector('[data-compassu-name-head]')){
        accountHeader.textContent='Name';
        accountHeader.dataset.compassuNameHead='1';
      }
      if(accountHeader&&!head.querySelector('[data-compassu-email-head]')){
        const emailHead=document.createElement('th');
        emailHead.textContent='Email';
        emailHead.dataset.compassuEmailHead='1';
        accountHeader.insertAdjacentElement('afterend',emailHead);
      }
      if(!head.querySelector('[data-compassu-institution-head]')){
        const first=head.querySelector('th');
        if(first){
          const institutionHead=document.createElement('th');
          institutionHead.textContent='Institution';
          institutionHead.dataset.compassuInstitutionHead='1';
          first.insertAdjacentElement('afterend',institutionHead);
        }
      }
    }

    function ensureRowStructure(row,email){
      if(!email)return null;
      const cells=[...row.querySelectorAll('td')];
      const accountCell=cells.find(td=>String(td.textContent||'').toLowerCase().includes(email));
      if(!accountCell)return null;

      const nameNode=accountCell.querySelector('b');
      const name=String(nameNode?.textContent||'').trim()||'Unnamed account';
      const stateNode=[...accountCell.querySelectorAll('small')].find(el=>String(el.textContent||'').trim().toLowerCase()!==email);
      const state=String(stateNode?.textContent||'').trim();

      accountCell.textContent='';
      accountCell.dataset.compassuNameCell='1';
      const nameStrong=document.createElement('b');
      nameStrong.textContent=name;
      accountCell.appendChild(nameStrong);
      if(state){const small=document.createElement('small');small.textContent=state;small.style.display='block';small.style.marginTop='4px';accountCell.appendChild(small)}

      let emailCell=row.querySelector('[data-compassu-email-cell]');
      if(!emailCell){
        emailCell=document.createElement('td');
        emailCell.dataset.compassuEmailCell='1';
        accountCell.insertAdjacentElement('afterend',emailCell);
      }
      emailCell.textContent=email;
      emailCell.style.overflowWrap='anywhere';

      let institutionCell=row.querySelector('[data-compassu-institution-cell]');
      if(!institutionCell){
        const first=row.querySelector('td');
        institutionCell=document.createElement('td');
        institutionCell.dataset.compassuInstitutionCell='1';
        first?.insertAdjacentElement('afterend',institutionCell);
      }
      return {institutionCell,emailCell};
    }

    function paint(){
      ensureHeaders();
      for(const row of visibleRows()){
        const email=emailForRow(row);if(!email)continue;
        const structure=ensureRowStructure(row,email);if(!structure)continue;
        const user=userMap.get(email)||{};
        const institution=String(user.institution||'').trim();
        structure.institutionCell.textContent=institution||'—';
      }
    }

    async function refresh(force=false){
      if(stopped||requestInFlight)return;
      const session=readSession();if(!session?.access_token)return;
      const state=readState();
      const signature=JSON.stringify([state.page||1,state.page_size||50,state.search||'',state.institution||'']);
      if(!force&&signature===lastSignature&&userMap.size){paint();return}
      requestInFlight=true;
      try{
        const response=await fetch('/api/admin/console50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'account_page',page:state.page||1,page_size:state.page_size||50,search:state.search||'',institution:state.institution||''}),cache:'no-store'});
        const body=await response.json().catch(()=>({}));
        if(response.ok){
          userMap=new Map((Array.isArray(body?.users)?body.users:[]).map(user=>[String(user?.email||'').trim().toLowerCase(),user]));
          lastSignature=signature;
          paint();
        }
      }catch{}finally{requestInFlight=false}
    }

    const schedule=(force=false)=>{clearTimeout(timer);timer=setTimeout(()=>refresh(force),80)};
    const observer=new MutationObserver(()=>schedule(false));
    observer.observe(document.body,{childList:true,subtree:true});
    const onInstitutions=()=>schedule(true);
    window.addEventListener('compassu:institutions-updated',onInstitutions);
    window.addEventListener('compassu-admin-50k-refresh',onInstitutions);
    const interval=setInterval(()=>{paint();refresh(false)},1200);
    schedule(true);
    return()=>{stopped=true;clearTimeout(timer);clearInterval(interval);observer.disconnect();window.removeEventListener('compassu:institutions-updated',onInstitutions);window.removeEventListener('compassu-admin-50k-refresh',onInstitutions)};
  },[]);
  return null;
}
