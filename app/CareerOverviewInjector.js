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
      if(card&&!card.querySelector('.careerOverviewNote')){
        const n=document.createElement('div');
        n.className='careerOverviewNote small muted';
        n.textContent=`${careerDescriptionNote} Average annual openings are displayed as full estimated job counts from BLS projections.`;
        Object.assign(n.style,{marginTop:'12px',lineHeight:'1.5'});
        card.appendChild(n);
      }
    };
    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,80)});
    observer.observe(document.body,{childList:true,subtree:true});
    apply();
    return()=>{clearTimeout(timer);observer.disconnect()};
  },[]);
  return null;
}
