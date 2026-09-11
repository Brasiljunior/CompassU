'use client';

import {useEffect} from 'react';

const STATE_KEY='compassu_admin_50k_state';
const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const ADMIN_URL=`${SUPABASE_URL}/functions/v1/admin-console-50k`;
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

    function ensureHeaders(){
      const head=table()?.querySelector('thead tr');
      if(!head)return;
      const headers=[...head.querySelectorAll('th')];
      if(!headers.length)return;
      let nameHead=head.querySelector('[data-compassu-name-head]')||headers.find(th=>String(th.textContent||'').trim().toLowerCase()==='account');
      if(nameHead){nameHead.textContent='Name';nameHead.dataset.compassuNameHead='1'}
      if(nameHead&&!head.querySelector('[data-compassu-email-head]')){
        const emailHead=document.createElement('th');
        emailHead.textContent='Email';
        emailHead.dataset.compassuEmailHead='1';
        nameHead.insertAdjacentElement('afterend',emailHead);
      }
      if(!head.querySelector('[data-compassu-institution-head]')){
        const first=head.querySelector('th');
        if(first){const institutionHead=document.createElement('th');institutionHead.textContent='Institution';institutionHead.dataset.compassuInstitutionHead='1';first.insertAdjacentElement('afterend',institutionHead)}
      }
    }

    function renderRow(row,user){
      if(!row||!user)return;
      const canonicalEmail=String(user.email||'').trim().toLowerCase();
      row.dataset.compassuAccountEmail=canonicalEmail;

      let nameCell=row.querySelector('[data-compassu-name-cell]');
      if(!nameCell){
        const cells=[...row.querySelectorAll('td')];
        nameCell=cells.find(td=>td.querySelector('b')&&!td.classList.contains('accountSelectCell'))||cells[1]||null;
        if(nameCell)nameCell.dataset.compassuNameCell='1';
      }
      if(!nameCell)return;

      nameCell.textContent='';
      const strong=document.createElement('b');
      strong.textContent=[user.first_name,user.last_name].filter(Boolean).join(' ')||'Unnamed account';
      nameCell.appendChild(strong);
      if(user.state){const small=document.createElement('small');small.textContent=String(user.state);small.style.display='block';small.style.marginTop='4px';nameCell.appendChild(small)}

      let emailCell=row.querySelector('[data-compassu-email-cell]');
      if(!emailCell){emailCell=document.createElement('td');emailCell.dataset.compassuEmailCell='1';nameCell.insertAdjacentElement('afterend',emailCell)}
      emailCell.textContent=canonicalEmail||'—';
      emailCell.style.overflowWrap='anywhere';

      let institutionCell=row.querySelector('[data-compassu-institution-cell]');
      if(!institutionCell){const first=row.querySelector('td');institutionCell=document.createElement('td');institutionCell.dataset.compassuInstitutionCell='1';first?.insertAdjacentElement('afterend',institutionCell)}
      institutionCell.textContent=String(user.institution||'').trim()||'—';
      institutionCell.dataset.authoritative50k='1';
    }

    function paint(){
      if(!currentUsers.length)return;
      ensureHeaders();
      const rows=visibleRows();
      rows.forEach((row,index)=>renderRow(row,currentUsers[index]));
    }

    async function refresh(force=false){
      if(stopped||requestInFlight)return;
      const session=readSession();if(!session?.access_token)return;
      const state=readState();
      const signature=JSON.stringify([state.page||1,state.page_size||50,state.search||'',state.institution||'']);
      if(!force&&signature===lastSignature&&currentUsers.length){paint();return}
      requestInFlight=true;
      try{
        const response=await fetch(ADMIN_URL,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'account_page',page:state.page||1,page_size:state.page_size||50,search:state.search||'',institution:state.institution||''}),cache:'no-store'});
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
