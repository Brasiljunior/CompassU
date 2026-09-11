'use client';

import { useEffect } from 'react';

const NOTICE_ID='compassu-legal-notice';

export default function LegalConsentEnhancer(){
 useEffect(()=>{
  const enhance=()=>{
   const buttons=[...document.querySelectorAll('button')];
   const primary=buttons.find(button=>button.textContent?.includes('Begin My Journey'));
   if(!primary)return;
   const panel=primary.closest('.panel') || primary.parentElement;
   if(!panel || panel.querySelector(`#${NOTICE_ID}`))return;

   const notice=document.createElement('div');
   notice.id=NOTICE_ID;
   notice.setAttribute('role','note');
   notice.style.cssText='margin:12px 0 14px;padding:12px 14px;border:1px solid #dbe4f0;border-radius:12px;background:#f8fafc;font-size:13px;line-height:1.55;color:#334155;';
   notice.innerHTML='By creating a CompassU account, you agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style="font-weight:800;color:#2f6df6;text-decoration:underline">Terms of Service</a> and acknowledge the <a href="/privacy" target="_blank" rel="noopener noreferrer" style="font-weight:800;color:#2f6df6;text-decoration:underline">Privacy Notice</a>. CompassU is intended for students age 13 and older. Use by a child under 13 requires a separately approved school-authorized or parental-consent process.';
   panel.insertBefore(notice,primary.nextSibling);
  };

  enhance();
  const observer=new MutationObserver(enhance);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 return null;
}
