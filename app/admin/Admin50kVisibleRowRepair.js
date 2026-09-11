'use client';

import {useEffect} from 'react';

const STATE_KEY='compassu_admin_50k_state';
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const readState=()=>{try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')||{page:1,page_size:50,search:'',institution:''}}catch{return{page:1,page_size:50,search:'',institution:''}}};

export default function Admin50kVisibleRowRepair(){
  useEffect(()=>{
    let stopped=false;
    let timer=null;
    let requestInFlight=false;
    let lastSignature='';
    let currentUsers=[];

    const table=()=>document.querySelector('.adminTable');
    const visibleRows=()=>[...document.querySelectorAll('.adminTable tbody tr')];

    function rebuildHeader(){
      const head=table()?.querySelector('thead tr');
      if(!head)return;
      const existing=[...head.querySelectorAll('th')];
      const selectHead=existing.find(th=>th.classList.contains('accountSelectCell'))||existing[0];
      if(!selectHead)return;
      while(head.firstChild)head.removeChild(head.firstChild);
      head.appendChild(selectHead);
      for(const label of ['Institution','First Name','Last Name','Email','Created','Last Sign In','Survey Status','Access','Actions']){
        const th=document.createElement('th');
        th.textContent=label;
        th.dataset.compassuCanonicalHead=label.toLowerCase().replace(/\s+/g,'-');
        head.appendChild(th);
      }
    }

    function canonicalCell(value,kind){
      const td=document.createElement('td');
      td.dataset.compassuCanonicalCell=kind;
      td.textContent=String(value??'').trim()||'—';
      if(kind==='email')td.style.overflowWrap='anywhere';
      return td;
    }

    function renderRow(row,user){
      if(!row||!user)return;
      const cells=[...row.querySelectorAll(':scope > td')];
      if(cells.length<7)return;

      const selectCell=cells.find(td=>td.classList.contains('accountSelectCell'))||cells[0];
      let created=cells.find(td=>td.dataset.compassuOriginal==='created');
      let lastSignIn=cells.find(td=>td.dataset.compassuOriginal==='last-sign-in');
      let survey=cells.find(td=>td.dataset.compassuOriginal==='survey-status');
      let access=cells.find(td=>td.dataset.compassuOriginal==='access');
      let actions=cells.find(td=>td.dataset.compassuOriginal==='actions');

      if(!created||!lastSignIn||!survey||!access||!actions){
        // The base React table is: select, account, created, last sign in, survey, access, actions.
        const nonSelect=cells.filter(td=>td!==selectCell && !td.dataset.compassuCanonicalCell);
        // Recover by position from the unmodified React cells.
        const base=nonSelect.length>=6?nonSelect:cells.filter(td=>td!==selectCell);
        created=base[1]||created;
        lastSignIn=base[2]||lastSignIn;
        survey=base[3]||survey;
        access=base[4]||access;
        actions=base[5]||actions;
        if(created)created.dataset.compassuOriginal='created';
        if(lastSignIn)lastSignIn.dataset.compassuOriginal='last-sign-in';
        if(survey)survey.dataset.compassuOriginal='survey-status';
        if(access)access.dataset.compassuOriginal='access';
        if(actions)actions.dataset.compassuOriginal='actions';
      }
      if(!created||!lastSignIn||!survey||!access||!actions)return;

      while(row.firstChild)row.removeChild(row.firstChild);
      row.appendChild(selectCell);
      row.appendChild(canonicalCell(user.institution,'institution'));
      row.appendChild(canonicalCell(user.first_name,'first-name'));
      row.appendChild(canonicalCell(user.last_name,'last-name'));
      row.appendChild(canonicalCell(String(user.email||'').toLowerCase(),'email'));
      row.appendChild(created);
      row.appendChild(lastSignIn);
      row.appendChild(survey);
      row.appendChild(access);
      row.appendChild(actions);
      row.dataset.compassuAccountEmail=String(user.email||'').toLowerCase();
      row.dataset.compassuCanonical50k='1';
    }

    function paint(){
      rebuildHeader();
      const rows=visibleRows();
      rows.forEach((row,index)=>renderRow(row,currentUsers[index]));
    }

    async function refresh(force=false){
      if(stopped||requestInFlight)return;
      const session=readSession();
      if(!session?.access_token)return;
      const state=readState();
      const signature=JSON.stringify([state.page||1,state.page_size||50,state.search||'',state.institution||'']);
      if(!force&&signature===lastSignature&&currentUsers.length){paint();return}
      requestInFlight=true;
      try{
        const response=await fetch('/api/admin/console50k',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'account_page',page:state.page||1,page_size:state.page_size||50,search:state.search||'',institution:state.institution||''}),cache:'no-store'});
        const body=await response.json().catch(()=>({}));
        if(response.ok){currentUsers=Array.isArray(body?.users)?body.users:[];lastSignature=signature;paint()}
      }catch{}finally{requestInFlight=false}
    }

    const schedule=(force=false)=>{clearTimeout(timer);timer=setTimeout(()=>refresh(force),80)};
    const observer=new MutationObserver(()=>schedule(false));
    observer.observe(document.body,{childList:true,subtree:true});
    const onRefresh=()=>schedule(true);
    window.addEventListener('compassu:institutions-updated',onRefresh);
    window.addEventListener('compassu-admin-50k-refresh',onRefresh);
    const interval=setInterval(()=>{paint();refresh(false)},1200);
    schedule(true);
    return()=>{stopped=true;clearTimeout(timer);clearInterval(interval);observer.disconnect();window.removeEventListener('compassu:institutions-updated',onRefresh);window.removeEventListener('compassu-admin-50k-refresh',onRefresh)};
  },[]);
  return null;
}
