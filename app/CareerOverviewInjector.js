'use client';

import {useEffect} from 'react';
import {getCareerDescription,careerDescriptionNote} from './careerDescriptions';

export default function CareerOverviewInjector(){
  useEffect(()=>{
    let timer=null;
    const updateLocalOpenings=async(card,location,status)=>{
      if(!location)return;
      const careers=[...card.querySelectorAll('.career')];
      status.textContent=`Loading local labor-market projections for ${location}…`;
      let updated=0;
      let configurationMissing=false;
      await Promise.all(careers.map(async career=>{
        const title=career.querySelector('.careerToggle b')?.textContent?.trim();
        if(!title)return;
        const metrics=[...career.querySelectorAll('.metric')];
        const openingMetric=metrics.find(metric=>{
          const label=metric.querySelector('span')?.textContent?.trim()||'';
          return label==='Average annual openings'||label==='U.S. average annual openings'||label.startsWith('Projected annual openings');
        });
        if(!openingMetric)return;
        const label=openingMetric.querySelector('span');
        const value=openingMetric.querySelector('b')||openingMetric.querySelector('strong');
        if(!label||!value)return;
        if(!openingMetric.dataset.usValue) openingMetric.dataset.usValue=value.textContent?.trim()||'';
        try{
          const response=await fetch(`/api/local-career-openings?occupation=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}`);
          const data=await response.json();
          if(data?.configured===false){configurationMissing=true;return;}
          if(response.ok&&data?.available&&Number.isFinite(data.annualOpenings)){
            label.textContent=`Projected annual openings — ${data.area||location}`;
            value.textContent=Number(data.annualOpenings).toLocaleString();
            updated++;
          }else{
            label.textContent='U.S. average annual openings';
            value.textContent=openingMetric.dataset.usValue;
          }
        }catch{
          label.textContent='U.S. average annual openings';
          value.textContent=openingMetric.dataset.usValue;
        }
      }));
      if(configurationMissing){
        status.textContent=`Location applied: ${location}. Local projected openings are ready for activation once the CareerOneStop API credential is configured; U.S. BLS openings remain displayed for now.`;
      }else if(updated){
        status.textContent=`Location applied: ${location}. Career Waypoints now shows available location-specific projected annual openings; careers without local projection data retain the U.S. figure.`;
      }else{
        status.textContent=`Location applied: ${location}. No local projection was returned for these careers, so U.S. BLS openings remain displayed.`;
      }
    };
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
          if(label?.textContent?.trim()==='Annual openings') label.textContent='U.S. average annual openings';
          if(label?.textContent?.trim()==='Average annual openings') label.textContent='U.S. average annual openings';
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
            if(location) updateLocalOpenings(card,location,status);
            else status.textContent='Searching broadly. Enter a city, state, or ZIP code to load local projected openings and narrow the job-site searches.';
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
          n.textContent=`${careerDescriptionNote} U.S. average annual openings use BLS projections. When a location is applied and local projection data is available, CompassU replaces that figure with the location-specific projected annual openings and labels the geographic area.`;
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
