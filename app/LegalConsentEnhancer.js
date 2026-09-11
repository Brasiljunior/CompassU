'use client';

import { useEffect } from 'react';

const CONSENT_ID='compassu-legal-consent';
const MESSAGE_ID='compassu-legal-message';
const TERMS_VERSION='2026-09-11';
const PRIVACY_VERSION='2026-09-11';

export default function LegalConsentEnhancer(){
 useEffect(()=>{
  const originalFetch=window.fetch.bind(window);
  const consentAccepted=()=>document.querySelector(`#${CONSENT_ID} input[type="checkbox"]`)?.checked===true;
  const showMessage=()=>{
   const message=document.getElementById(MESSAGE_ID);
   if(message){message.textContent='Please accept the Terms of Service and acknowledge the Privacy Notice before creating your account.';message.style.display='block';}
  };

  window.fetch=async(input,init={})=>{
   const url=typeof input==='string'?input:input?.url||'';
   if(url.includes('/auth/v1/signup')){
    if(!consentAccepted()){
     showMessage();
     return new Response(JSON.stringify({msg:'Please accept the Terms of Service and acknowledge the Privacy Notice before creating your account.'}),{status:400,headers:{'Content-Type':'application/json'}});
    }
    if(init?.body){
     try{
      const body=JSON.parse(init.body);
      body.data={...(body.data||{}),legal_terms_version:TERMS_VERSION,privacy_notice_version:PRIVACY_VERSION,legal_accepted_at:new Date().toISOString(),legal_acceptance_source:'account_creation'};
      init={...init,body:JSON.stringify(body)};
     }catch{}
    }
   }
   return originalFetch(input,init);
  };

  const enhance=()=>{
   const headings=[...document.querySelectorAll('h2')];
   const heading=headings.find(node=>node.textContent?.includes('Start your CompassU journey'));
   if(!heading)return;
   const panel=heading.closest('.panel');
   if(!panel || panel.querySelector(`#${CONSENT_ID}`))return;
   const primary=[...panel.querySelectorAll('button')].find(button=>button.textContent?.includes('Begin My Journey'));
   if(!primary)return;

   const wrap=document.createElement('div');
   wrap.id=CONSENT_ID;
   wrap.style.cssText='margin:16px 0 14px;padding:14px 15px;border:1px solid #dbe4f0;border-radius:12px;background:#f8fafc;font-size:13px;line-height:1.55;color:#334155;';
   const label=document.createElement('label');
   label.style.cssText='display:flex;gap:10px;align-items:flex-start;cursor:pointer;';
   const checkbox=document.createElement('input');
   checkbox.type='checkbox';
   checkbox.required=true;
   checkbox.setAttribute('aria-describedby',MESSAGE_ID);
   checkbox.style.cssText='margin-top:3px;width:17px;height:17px;flex:0 0 auto;';
   checkbox.addEventListener('change',()=>{const m=document.getElementById(MESSAGE_ID);if(m&&checkbox.checked)m.style.display='none';});
   const text=document.createElement('span');
   text.innerHTML='I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style="font-weight:800;color:#2f6df6">Terms of Service</a> and acknowledge the <a href="/privacy" target="_blank" rel="noopener noreferrer" style="font-weight:800;color:#2f6df6">Privacy Notice</a>.';
   label.append(checkbox,text);
   const message=document.createElement('div');
   message.id=MESSAGE_ID;
   message.setAttribute('role','alert');
   message.setAttribute('aria-live','polite');
   message.style.cssText='display:none;margin-top:8px;color:#b42318;font-weight:700;';
   wrap.append(label,message);
   panel.insertBefore(wrap,primary);

   primary.addEventListener('click',(event)=>{
    if(!checkbox.checked){
     event.preventDefault();
     event.stopImmediatePropagation();
     showMessage();
     checkbox.focus();
    }
   },true);
  };

  enhance();
  const observer=new MutationObserver(enhance);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();window.fetch=originalFetch;};
 },[]);
 return null;
}
