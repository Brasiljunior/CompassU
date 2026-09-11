'use client';

import { useEffect } from 'react';

const STATE_KEY='compassu_admin_50k_state';
const readState=()=>{try{return JSON.parse(sessionStorage.getItem(STATE_KEY)||'null')||{page:1,page_size:50,search:''}}catch{return{page:1,page_size:50,search:''}}};
const writeState=s=>{try{sessionStorage.setItem(STATE_KEY,JSON.stringify(s))}catch{}};

export default function Admin50kPagingEnhancer(){
  useEffect(()=>{
    const originalFetch=window.fetch.bind(window);
    let state=readState();
    let pagination=null;
    let scheduled=false;

    const refreshDashboard=()=>{
      const button=[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Refresh Dashboard'));
      if(button&&!button.disabled)button.click();
    };

    const renderControls=()=>{
      const wrap=document.querySelector('.adminTableWrap');
      if(!wrap||!pagination)return;
      let controls=document.getElementById('compassu-50k-pagination');
      if(!controls){
        controls=document.createElement('div');
        controls.id='compassu-50k-pagination';
        controls.style.display='flex';
        controls.style.flexWrap='wrap';
        controls.style.gap='10px';
        controls.style.alignItems='center';
        controls.style.justifyContent='space-between';
        controls.style.padding='14px 4px 4px';
        wrap.appendChild(controls);
      }
      const total=Number(pagination.total||0),page=Number(pagination.page||1),pages=Number(pagination.total_pages||1),pageSize=Number(pagination.page_size||state.page_size||50);
      controls.innerHTML=`<div style="font-weight:700">${total.toLocaleString()} accounts • Page ${page.toLocaleString()} of ${pages.toLocaleString()}</div><div style="display:flex;gap:8px;align-items:center"><button type="button" data-first ${page<=1?'disabled':''}>First</button><button type="button" data-prev ${page<=1?'disabled':''}>Previous</button><button type="button" data-next ${page>=pages?'disabled':''}>Next</button><button type="button" data-last ${page>=pages?'disabled':''}>Last</button><select data-size aria-label="Accounts per page"><option value="25">25/page</option><option value="50">50/page</option><option value="100">100/page</option></select></div>`;
      controls.querySelector('[data-size]').value=String(pageSize);
      const go=next=>{state={...state,page:Math.max(1,Math.min(pages,next))};writeState(state);refreshDashboard()};
      controls.querySelector('[data-first]')?.addEventListener('click',()=>go(1));
      controls.querySelector('[data-prev]')?.addEventListener('click',()=>go(page-1));
      controls.querySelector('[data-next]')?.addEventListener('click',()=>go(page+1));
      controls.querySelector('[data-last]')?.addEventListener('click',()=>go(pages));
      controls.querySelector('[data-size]')?.addEventListener('change',e=>{state={...state,page:1,page_size:Number(e.target.value)||50};writeState(state);refreshDashboard()});

      const search=document.querySelector('.adminSearch[placeholder*="Search"]');
      if(search&&!search.dataset.server50k){
        search.dataset.server50k='1';
        search.placeholder='Search all accounts — press Enter';
        search.addEventListener('keydown',e=>{
          if(e.key==='Enter'){
            state={...state,page:1,search:String(search.value||'').trim()};
            writeState(state);
            refreshDashboard();
          }
        });
      }
    };

    const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderControls()})};

    window.fetch=async(input,init)=>{
      let nextInit=init;
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(rawUrl?.includes('/api/admin/console50k')&&init?.body){
          const body=JSON.parse(init.body);
          if(body?.action==='overview'||body?.action==='refresh'){
            const liveSearch=document.querySelector('.adminSearch[placeholder*="Search"]')?.value;
            if(typeof liveSearch==='string'&&liveSearch.trim()===state.search){/* keep current committed search */}
            body.page=state.page||1;
            body.page_size=state.page_size||50;
            body.search=state.search||'';
            nextInit={...init,body:JSON.stringify(body)};
          }
        }
      }catch{}
      const response=await originalFetch(input,nextInit);
      try{
        const rawUrl=typeof input==='string'?input:input?.url;
        if(rawUrl?.includes('/api/admin/console50k')&&response.ok){
          const body=await response.clone().json();
          if(body?.pagination){pagination=body.pagination;state={...state,page:Number(pagination.page||1),page_size:Number(pagination.page_size||state.page_size||50)};writeState(state);schedule()}
        }
      }catch{}
      return response;
    };

    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true});
    schedule();
    return()=>{window.fetch=originalFetch;observer.disconnect()};
  },[]);
  return null;
}
