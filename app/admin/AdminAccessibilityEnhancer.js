'use client';

import { useEffect } from 'react';

const slug=(value='')=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export default function AdminAccessibilityEnhancer(){
  useEffect(()=>{
    const enhance=()=>{
      const main=document.querySelector('.adminMain, .adminLoginWrap, main');
      if(main&&!main.id)main.id='admin-main-content';

      if(!document.querySelector('.adminSkipLink')){
        const skip=document.createElement('a');
        skip.className='adminSkipLink';
        skip.href='#admin-main-content';
        skip.textContent='Skip to administrator content';
        document.body.prepend(skip);
      }

      document.querySelectorAll('.error').forEach(node=>{node.setAttribute('role','alert');node.setAttribute('aria-live','assertive')});
      document.querySelectorAll('.success,.adminNotice').forEach(node=>{if(!node.classList.contains('error')){node.setAttribute('role','status');node.setAttribute('aria-live','polite')}});

      document.querySelectorAll('input,select,textarea').forEach((field,index)=>{
        if(!field.id)field.id=`admin-field-${index+1}`;
        if(!field.getAttribute('aria-label')&&!field.getAttribute('aria-labelledby')){
          const parent=field.parentElement;
          const label=parent?.querySelector(':scope > label');
          if(label){label.htmlFor=field.id}
          else if(field.placeholder)field.setAttribute('aria-label',field.placeholder);
        }
      });

      document.querySelectorAll('table').forEach((table,index)=>{
        if(!table.getAttribute('aria-label')&&!table.getAttribute('aria-labelledby')){
          const section=table.closest('section,.adminPanel,div');
          const heading=section?.querySelector('h2,h3');
          if(heading){if(!heading.id)heading.id=`admin-table-heading-${index+1}`;table.setAttribute('aria-labelledby',heading.id)}
          else table.setAttribute('aria-label','Administrator data table');
        }
        table.querySelectorAll('th').forEach(th=>{if(!th.hasAttribute('scope'))th.setAttribute('scope','col')});
      });

      document.querySelectorAll('.trendBars').forEach(chart=>{
        chart.setAttribute('role','img');
        chart.setAttribute('aria-label','Thirty-day activity trend showing new accounts and completed assessments by day.');
        chart.querySelectorAll('.trendDay').forEach(day=>day.setAttribute('aria-hidden','true'));
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

      document.querySelectorAll('input[type="checkbox"]').forEach(box=>{if(!box.getAttribute('aria-label')&&!box.getAttribute('aria-labelledby'))box.setAttribute('aria-label','Select account')});
    };

    enhance();
    const observer=new MutationObserver(enhance);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
