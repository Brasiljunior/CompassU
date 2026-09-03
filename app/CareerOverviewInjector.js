'use client';

import {useEffect} from 'react';
import {getCareerDescription,careerDescriptionNote} from './careerDescriptions';

export default function CareerOverviewInjector(){
  useEffect(()=>{
    let timer=null;
    const apply=()=>{
      document.querySelectorAll('.career').forEach(card=>{
        const toggle=card.querySelector('.careerToggle');
        const title=toggle?.querySelector('b')?.textContent?.trim();
        const host=toggle?.querySelector('.topbar > div');
        if(title&&host&&!host.querySelector('.careerOverview')){
          const p=document.createElement('div');
          p.className='careerOverview';
          p.textContent=getCareerDescription(title);
          Object.assign(p.style,{fontSize:'12px',lineHeight:'1.5',color:'#475467',marginTop:'6px',maxWidth:'650px'});
          host.appendChild(p);
        }
        card.querySelectorAll('.metric').forEach(metric=>{
          const label=metric.querySelector('span');
          if(label?.textContent?.trim()==='Annual openings') label.textContent='Average annual openings';
        });
      });
      const card=[...document.querySelectorAll('.card')].find(el=>el.querySelector('.sectionTitle')?.textContent?.trim()==='Career Waypoints');
      if(card){
        const head=card.querySelector('.jobSearchHead');
        const input=head?.querySelector('.jobLocation');
        if(input&&!head.querySelector('.jobLocationApply')){
          input.placeholder='City, state, or ZIP';
          input.setAttribute('autocomplete','postal-code');
          const button=document.createElement('button');
          button.type='button';
          button.className='btn tiny primary jobLocationApply';
          button.textContent='Apply Location';
          Object.assign(button.style,{marginLeft:'8px',whiteSpace:'nowrap'});
          const status=document.createElement('div');
          status.className='jobLocationStatus small';
          Object.assign(status.style,{marginTop:'8px',color:'#344054',fontWeight:'600'});
          const confirm=()=>{
            const location=input.value.trim();
            status.textContent=location
              ? `Location applied: ${location}. Choose a job site below to view live openings near this location.`
              : 'Searching broadly. Enter a city, state, or ZIP code to narrow the job-site searches.';
          };
          button.addEventListener('click',confirm);
          input.addEventListener('keydown',e=>{
            if(e.key==='Enter'){
              e.preventDefault();
              confirm();
            }
          });
          head.appendChild(button);
          head.insertAdjacentElement('afterend',status);
        }
        if(!card.querySelector('.careerOverviewNote')){
          const n=document.createElement('div');
          n.className='careerOverviewNote small muted';
          n.textContent=`${careerDescriptionNote} Average annual openings are displayed as full estimated job counts from BLS projections.`;
          Object.assign(n.style,{marginTop:'12px',lineHeight:'1.5'});
          card.appendChild(n);
        }
      }
    };
    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,80)});
    observer.observe(document.body,{childList:true,subtree:true});
    apply();
    return()=>{clearTimeout(timer);observer.disconnect()};
  },[]);
  return null;
}
