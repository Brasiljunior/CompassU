'use client';

import { useEffect } from 'react';

function slugify(value=''){
  return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'field';
}

export default function AccessibilityEnhancer(){
  useEffect(()=>{
    let fieldCounter=0;
    let lastMain=null;
    let initializedMain=false;

    const enhance=()=>{
      document.querySelectorAll('.nav').forEach((node)=>{
        if(!node.hasAttribute('role')) node.setAttribute('role','navigation');
        if(!node.hasAttribute('aria-label')) node.setAttribute('aria-label','Primary navigation');
      });

      const mainCandidate=document.querySelector('main,.assessment,.dashboard,.center');
      if(mainCandidate && !mainCandidate.id) mainCandidate.id='main-content';
      if(mainCandidate && mainCandidate.tagName!=='MAIN' && !mainCandidate.hasAttribute('role')) mainCandidate.setAttribute('role','main');
      if(mainCandidate && mainCandidate!==lastMain){
        if(initializedMain){
          mainCandidate.setAttribute('tabindex','-1');
          requestAnimationFrame(()=>mainCandidate.focus({preventScroll:false}));
        }
        lastMain=mainCandidate;
        initializedMain=true;
      }

      document.querySelectorAll('.field').forEach((field)=>{
        const input=field.querySelector('input,select,textarea');
        const label=field.querySelector('label');
        if(!input||!label) return;
        if(!input.id){
          fieldCounter+=1;
          input.id=`compassu-${slugify(label.textContent)}-${fieldCounter}`;
        }
        if(!label.htmlFor) label.htmlFor=input.id;
        const text=(label.textContent||'').trim().toLowerCase();
        if(input.tagName==='INPUT'){
          if(text.includes('first name')) input.autocomplete='given-name';
          else if(text.includes('last name')) input.autocomplete='family-name';
          else if(text==='email') input.autocomplete='email';
          else if(text.includes('new password')||text.includes('create password')) input.autocomplete='new-password';
          else if(text.includes('current password')) input.autocomplete='current-password';
          else if(text==='password'){
            const activeTab=(document.querySelector('.tabs .primary')?.textContent||'').trim().toLowerCase();
            input.autocomplete=activeTab.includes('create')?'new-password':'current-password';
          }
        }
      });

      document.querySelectorAll('.error').forEach((node)=>{
        node.setAttribute('role','alert');
        node.setAttribute('aria-live','assertive');
      });
      document.querySelectorAll('.success,.notice').forEach((node)=>{
        node.setAttribute('role','status');
        node.setAttribute('aria-live','polite');
      });

      document.querySelectorAll('.progressWrap').forEach((node)=>{
        const bar=node.querySelector('.progress');
        const width=bar?.style?.width||'';
        const value=Math.max(0,Math.min(100,parseInt(width,10)||0));
        node.setAttribute('role','progressbar');
        node.setAttribute('aria-label','Assessment progress');
        node.setAttribute('aria-valuemin','0');
        node.setAttribute('aria-valuemax','100');
        node.setAttribute('aria-valuenow',String(value));
        node.setAttribute('aria-valuetext',`${value}% complete`);
      });

      document.querySelectorAll('.qCard').forEach((card,index)=>{
        const question=card.querySelector('.question');
        const group=card.querySelector('.choices');
        if(question&&group){
          if(!question.id)question.id=`assessment-question-${index+1}`;
          group.setAttribute('role','radiogroup');
          group.setAttribute('aria-labelledby',question.id);
          group.removeAttribute('aria-label');
          group.querySelectorAll('button.choice').forEach((button)=>{
            button.setAttribute('role','radio');
            button.setAttribute('aria-checked',button.classList.contains('selected')?'true':'false');
            if(!button.hasAttribute('type')) button.setAttribute('type','button');
          });
        }
      });

      document.querySelectorAll('button').forEach((button)=>{
        if(!button.hasAttribute('type')) button.setAttribute('type','button');
        if(button.classList.contains('iconBtn') && !button.getAttribute('aria-label')){
          const text=(button.textContent||'').trim();
          if(text==='★'||text==='☆') button.setAttribute('aria-label',text==='★'?'Remove from saved majors':'Save major');
        }
      });

      document.querySelectorAll('a[target="_blank"]').forEach((link)=>{
        const label=link.getAttribute('aria-label')||link.textContent?.trim()||'Link';
        if(!/new (tab|window)/i.test(label)) link.setAttribute('aria-label',`${label} (opens in a new tab)`);
        if(!link.rel) link.rel='noopener noreferrer';
      });
    };

    enhance();
    const observer=new MutationObserver(enhance);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
    return()=>observer.disconnect();
  },[]);

  return null;
}
