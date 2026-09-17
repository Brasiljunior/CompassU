'use client';

import { useEffect } from 'react';

const slug=(value='')=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export default function AdminAccessibilityEnhancer(){
  useEffect(()=>{
    const enhance=()=>{
      const main=document.querySelector('.adminMain, .adminLoginWrap, main');
      if(main&&!main.id)main.id='admin-main-content';
      if(main&&!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1');

      if(!document.querySelector('.adminSkipLink')){
        const skip=document.createElement('a');
        skip.className='adminSkipLink';
        skip.href=`#${main?.id||'admin-main-content'}`;
        skip.textContent='Skip to administrator content';
        document.body.prepend(skip);
      }

      document.querySelectorAll('.error').forEach(node=>{node.setAttribute('role','alert');node.setAttribute('aria-live','assertive')});
      document.querySelectorAll('.success,.adminNotice,.analyticsLoading').forEach(node=>{if(!node.classList.contains('error')){node.setAttribute('role','status');node.setAttribute('aria-live','polite')}});

      document.querySelectorAll('input,select,textarea').forEach((field,index)=>{
        if(!field.id)field.id=`admin-field-${index+1}`;
        if(!field.getAttribute('aria-label')&&!field.getAttribute('aria-labelledby')){
          const label=field.closest('label')||field.parentElement?.querySelector(':scope > label');
          if(label){label.htmlFor=field.id}
          else if(field.placeholder)field.setAttribute('aria-label',field.placeholder);
        }
      });

      const analyticsInstitution=document.querySelector('.analyticsControls select');
      if(analyticsInstitution&&!analyticsInstitution.getAttribute('aria-label'))analyticsInstitution.setAttribute('aria-label','Institution filter');

      document.querySelectorAll('table').forEach((table,index)=>{
        if(!table.getAttribute('aria-label')&&!table.getAttribute('aria-labelledby')){
          const section=table.closest('section,.adminPanel,.analyticsCard,.comparisonResults,div');
          const heading=section?.querySelector('h2,h3');
          if(heading){if(!heading.id)heading.id=`admin-table-heading-${index+1}`;table.setAttribute('aria-labelledby',heading.id)}
          else table.setAttribute('aria-label','Administrator data table');
        }
        table.querySelectorAll('thead th').forEach(th=>{if(!th.hasAttribute('scope'))th.setAttribute('scope','col')});
      });

      document.querySelectorAll('.trendBars').forEach(chart=>{
        chart.setAttribute('role','img');
        chart.setAttribute('aria-label','Thirty-day activity trend showing new accounts and completed assessments by day.');
        chart.querySelectorAll('.trendDay').forEach(day=>day.setAttribute('aria-hidden','true'));
      });

      document.querySelectorAll('.clusterRow').forEach(row=>{
        const name=row.querySelector('.clusterTop b')?.textContent?.trim()||'Career cluster';
        const count=row.querySelector('.clusterTop span')?.textContent?.trim()||'';
        const track=row.querySelector('.clusterTrack');
        if(track){track.setAttribute('role','img');track.setAttribute('aria-label',`${name}: ${count} students`);track.querySelectorAll('*').forEach(el=>el.setAttribute('aria-hidden','true'))}
      });

      document.querySelectorAll('button').forEach(button=>{
        const text=button.textContent?.trim();
        if(!text&&!button.getAttribute('aria-label'))button.setAttribute('aria-label','Administrator action');
      });

      document.querySelectorAll('a[target="_blank"]').forEach(link=>{
        if(!link.getAttribute('aria-label'))link.setAttribute('aria-label',`${link.textContent?.trim()||'Open link'} (opens in a new tab)`);
        if(!link.rel)link.rel='noopener noreferrer';
      });

      document.querySelectorAll('.adminPanel').forEach((panel,index)=>{
        const heading=panel.querySelector('h2,h3');
        if(heading){if(!heading.id)heading.id=`admin-panel-${slug(heading.textContent)||index+1}`;panel.setAttribute('aria-labelledby',heading.id)}
      });

      document.querySelectorAll('.adminModal').forEach((modal,index)=>{
        modal.setAttribute('role','dialog');
        modal.setAttribute('aria-modal','true');
        if(!modal.hasAttribute('tabindex'))modal.setAttribute('tabindex','-1');
        const heading=modal.querySelector('h1,h2,h3');
        if(heading){if(!heading.id)heading.id=`admin-dialog-${index+1}`;modal.setAttribute('aria-labelledby',heading.id)}
      });
      document.querySelectorAll('.adminModalBackdrop').forEach(backdrop=>backdrop.setAttribute('role','presentation'));

      document.querySelectorAll('input[type="checkbox"]').forEach(box=>{
        if(box.getAttribute('aria-label')||box.getAttribute('aria-labelledby'))return;
        const text=box.closest('label')?.textContent?.trim();
        box.setAttribute('aria-label',text||'Select account');
      });
    };

    const onKeyDown=e=>{
      if(e.key!=='Tab')return;
      const modal=document.querySelector('.adminModal[aria-modal="true"]');
      if(!modal)return;
      const focusable=[...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hasAttribute('hidden'));
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    };

    enhance();
    const observer=new MutationObserver(enhance);
    observer.observe(document.body,{subtree:true,childList:true});
    document.addEventListener('keydown',onKeyDown,true);
    return()=>{observer.disconnect();document.removeEventListener('keydown',onKeyDown,true)};
  },[]);
  return null;
}
