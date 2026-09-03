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
          const value=metric.querySelector('b');
          if(!label||!value||label.textContent?.trim()!=='Annual openings'||value.dataset.blsOpeningsScaled==='true') return;
          const raw=Number(String(value.textContent||'').replace(/,/g,''));
          if(Number.isFinite(raw)){
            value.textContent=Math.round(raw*1000).toLocaleString('en-US');
            value.dataset.blsOpeningsScaled='true';
            label.textContent='Average annual openings';
          }
        });
      });
      const card=[...document.querySelectorAll('.card')].find(el=>el.querySelector('.sectionTitle')?.textContent?.trim()==='Career Waypoints');
      if(card&&!card.querySelector('.careerOverviewNote')){
        const n=document.createElement('div');
        n.className='careerOverviewNote small muted';
        n.textContent=`${careerDescriptionNote} BLS annual openings are reported in thousands in the source data; CompassU displays the full estimated number of openings.`;
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
