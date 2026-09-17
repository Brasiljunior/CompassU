'use client';

import {useEffect} from 'react';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const pct=v=>`${Number(v||0).toFixed(0)}%`;
const normalized=s=>(s||'').replace(/\s+/g,' ').trim().toLowerCase();
const describe=(name,rows=[])=>{const r=(Array.isArray(rows)?rows:[]).filter(x=>x?.trait_name&&x?.user_score!=null).sort((a,b)=>Number(b.user_score)-Number(a.user_score)).slice(0,2);if(r.length>=2)return `Your responses show especially strong alignment in ${r[0].trait_name} (${pct(r[0].user_score)}) and ${r[1].trait_name} (${pct(r[1].user_score)}). These patterns help explain why ${name} is one of your recommended directions and make it worth exploring through courses, careers, and college programs.`;if(r.length===1)return `Your responses show strong alignment in ${r[0].trait_name} (${pct(r[0].user_score)}), which helps explain why ${name} appears among your recommended directions. Explore its coursework and career options to see how well it fits your goals.`;return `${name} is one of your strongest CompassU recommendations based on patterns across your assessment responses. Use this match as a starting point to explore coursework, related careers, and college options.`};
const tailored={
 'criminal justice/safety studies':'Explore how to keep communities safe through law enforcement, corrections, homeland security, and crime prevention. This field combines real-world problem solving, public service, and an understanding of laws, human behavior, and the justice system.',
 'homeland security':'Focus on preventing and responding to threats such as natural disasters, cyberattacks, and terrorism. This field prepares you to protect people, infrastructure, and national security through planning, intelligence, and emergency management.',
 'legal assistant/paralegal':'Support attorneys and the legal system through research, case preparation, and document management. This field is a strong fit for students who value organization, attention to detail, communication, and an interest in law and justice.'
};

function cardName(card){const link=[...card.querySelectorAll('*')].find(el=>normalized(el.textContent)==='see why it fits, where it can lead, and where you can study it');const host=link?.parentElement;if(!host)return null;const title=[...host.querySelectorAll('b,strong')][0];return title?.textContent?.trim()||null}
function renderCard(card,text){const name=cardName(card);if(!name)return;let wrap=card.querySelector('.personalizedMajorDescription');if(!wrap){wrap=document.createElement('div');wrap.className='personalizedMajorDescription';Object.assign(wrap.style,{fontSize:'14px',lineHeight:'1.5',color:'#53657d',marginTop:'7px',marginBottom:'7px',maxWidth:'570px'});const link=[...card.querySelectorAll('*')].find(el=>normalized(el.textContent)==='see why it fits, where it can lead, and where you can study it');link?.parentElement?.insertBefore(wrap,link)}if(wrap)wrap.textContent=text||tailored[normalized(name)]||describe(name,[])}
function renderFallbacks(){document.querySelectorAll('.match').forEach(card=>{const name=cardName(card);if(name)renderCard(card,tailored[normalized(name)]||describe(name,[]))})}

export default function MajorDescriptions(){
 useEffect(()=>{
  let stopped=false,timer=null;
  const enrich=async()=>{renderFallbacks();try{
   const session=JSON.parse(localStorage.getItem('compassu_session')||'null');if(!session?.access_token||!session?.user?.id||!URL||!KEY)return;
   const headers={apikey:KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'};
   const attempts=await fetch(`${URL}/rest/v1/assessment_attempts?user_id=eq.${session.user.id}&status=eq.completed&select=id&order=completed_at.desc&limit=1`,{headers}).then(r=>r.json());const aid=attempts?.[0]?.id;if(!aid)return;
   const matches=await fetch(`${URL}/rest/v1/major_matches?attempt_id=eq.${aid}&select=major_id,match_score,rank,majors(name)&order=rank.asc&limit=10`,{headers}).then(r=>r.json());if(!Array.isArray(matches))return;
   const map={};await Promise.all(matches.map(async m=>{const name=m.majors?.name;if(!name)return;try{const rows=await fetch(`${URL}/rest/v1/rpc/get_major_explanation`,{method:'POST',headers,body:JSON.stringify({p_attempt_id:aid,p_major_id:m.major_id})}).then(r=>r.json());map[normalized(name)]=describe(name,rows)}catch{}}));
   if(stopped)return;document.querySelectorAll('.match').forEach(card=>{const name=cardName(card);if(name)renderCard(card,map[normalized(name)]||tailored[normalized(name)]||describe(name,[]))});
  }catch(error){console.error('CompassU major description enrichment failed',error)}};
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enrich,120)});observer.observe(document.body,{childList:true,subtree:true});enrich();return()=>{stopped=true;clearTimeout(timer);observer.disconnect()};
 },[]);
 return null;
}
