'use client';

import { useEffect, useState } from 'react';
import { calculatePersonalityCompass } from './personalityCompass';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';

export default function PersonalityCompassPanel(){
 const[traits,setTraits]=useState([]);
 useEffect(()=>{
  let cancelled=false;
  let lastAttemptId=null;
  async function load(){
   try{
    const session=JSON.parse(localStorage.getItem('compassu_session')||'null');
    if(!session?.user?.id||!session?.access_token){if(!cancelled)setTraits([]);return;}
    const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`};
    const attemptsResponse=await fetch(`${SUPABASE_URL}/rest/v1/assessment_attempts?user_id=eq.${session.user.id}&status=eq.completed&select=id&order=completed_at.desc&limit=1`,{headers,cache:'no-store'});
    if(!attemptsResponse.ok)throw new Error(`Attempt lookup failed (${attemptsResponse.status})`);
    const attempts=await attemptsResponse.json();
    if(!attempts?.[0]?.id)return;
    const attemptId=String(attempts[0].id);
    const questionsResponse=await fetch(`${SUPABASE_URL}/rest/v1/assessment_questions?question_number=gte.36&question_number=lte.50&select=id,question_number`,{headers,cache:'no-store'});
    if(!questionsResponse.ok)throw new Error(`Personality question lookup failed (${questionsResponse.status})`);
    const questions=await questionsResponse.json();
    if(!Array.isArray(questions)||!questions.length)return;
    const numberById=new Map(questions.map(q=>[String(q.id),Number(q.question_number)]));
    const ids=questions.map(q=>q.id).join(',');
    const responsesResponse=await fetch(`${SUPABASE_URL}/rest/v1/assessment_responses?attempt_id=eq.${attemptId}&question_id=in.(${ids})&select=question_id,response_value`,{headers,cache:'no-store'});
    if(!responsesResponse.ok)throw new Error(`Personality response lookup failed (${responsesResponse.status})`);
    const rows=await responsesResponse.json();
    const responses=(Array.isArray(rows)?rows:[]).map(r=>({question_number:numberById.get(String(r.question_id)),value:Number(r.response_value?.value)})).filter(r=>Number.isFinite(r.question_number)&&Number.isFinite(r.value));
    const top=calculatePersonalityCompass(responses);
    if(top.length>=3){try{localStorage.setItem('compassu_personality_traits',JSON.stringify(top));sessionStorage.setItem('compassu_personality_traits',JSON.stringify(top));}catch{}}
    lastAttemptId=attemptId;
    if(!cancelled)setTraits(top);
   }catch(error){console.error('Personality Compass could not load',error)}
  }
  load();
  const refresh=()=>load();
  const interval=window.setInterval(async()=>{
   try{
    const session=JSON.parse(localStorage.getItem('compassu_session')||'null');
    if(!session?.user?.id||!session?.access_token)return;
    const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`};
    const response=await fetch(`${SUPABASE_URL}/rest/v1/assessment_attempts?user_id=eq.${session.user.id}&status=eq.completed&select=id&order=completed_at.desc&limit=1`,{headers,cache:'no-store'});
    if(!response.ok)return;
    const attempts=await response.json();
    const currentId=attempts?.[0]?.id?String(attempts[0].id):null;
    if(currentId&&currentId!==lastAttemptId)load();
   }catch{}
  },2000);
  window.addEventListener('focus',refresh);
  window.addEventListener('storage',refresh);
  return()=>{cancelled=true;window.clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh)};
 },[]);
 if(!traits.length)return null;
 return <section className="personalityCompass" aria-labelledby="personality-compass-title">
  <div className="personalityCompassInner">
   <div className="personalityCompassHeading">
    <span className="eyebrow">Know Yourself</span>
    <h2 id="personality-compass-title">Your Personality Compass</h2>
    <p>Based on your CompassU responses, these are three personality tendencies that stand out most strongly. They describe patterns in how you may prefer to work, learn, communicate, and approach decisions—not fixed labels or a clinical personality assessment.</p>
   </div>
   <div className="personalityTraitGrid">{traits.map((trait,index)=><article className="personalityTraitCard" key={trait.key}>
    <div className="personalityTraitTop"><span className="personalityRank">{index+1}</span><div><h3>{trait.name}</h3><span className="personalityStrength">Strong tendency</span></div></div>
    <p>{trait.description}</p>
    <div className="personalityBar" aria-label={`${trait.name} response alignment ${trait.score} percent`}><div style={{width:`${trait.score}%`}}/></div>
    <div className="personalityScoreLabel">Response alignment <b>{trait.score}%</b></div>
   </article>)}</div>
  </div>
  <style jsx>{`
   .personalityCompass{max-width:1180px;margin:18px auto 0;padding:0 20px 18px}
   .personalityCompassInner{background:#fff;border:1px solid #e7eaf0;border-radius:18px;padding:24px;box-shadow:0 8px 24px rgba(27,39,69,.035)}
   .personalityCompassHeading{margin-bottom:20px}
   .personalityCompassHeading h2{margin:12px 0 8px;font-size:24px;line-height:1.2;letter-spacing:-.4px;color:#172033}
   .personalityCompassHeading p{margin:0;max-width:900px;color:#667085;font-size:14px;line-height:1.65}
   .eyebrow{display:inline-flex;background:#eef3ff;color:#2f6fed;font-weight:800;border-radius:999px;padding:7px 11px;font-size:12px}
   .personalityTraitGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
   .personalityTraitCard{position:relative;display:flex;flex-direction:column;min-height:250px;padding:20px;border:1px solid #e7eaf0;border-radius:16px;background:linear-gradient(145deg,#fff,#f9fbff);box-shadow:0 6px 18px rgba(27,39,69,.04);overflow:hidden}
   .personalityTraitCard:before{content:'';position:absolute;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#2f6fed,#6f5cff,#f4b740)}
   .personalityTraitTop{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
   .personalityRank{flex:0 0 36px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#eef3ff;color:#2f6fed;font-weight:850}
   .personalityTraitTop h3{margin:1px 0 5px;font-size:18px;line-height:1.25;color:#172033}
   .personalityStrength{display:inline-flex;padding:4px 8px;border-radius:999px;background:#ecfdf3;color:#19764b;font-size:11px;font-weight:800}
   .personalityTraitCard>p{margin:0 0 18px;color:#475467;font-size:14px;line-height:1.6;flex:1}
   .personalityBar{height:8px;background:#edf0f5;border-radius:999px;overflow:hidden;margin-top:auto}
   .personalityBar div{height:100%;border-radius:999px;background:linear-gradient(90deg,#2f6fed,#6f5cff,#f4b740)}
   .personalityScoreLabel{display:flex;justify-content:space-between;gap:12px;margin-top:9px;color:#667085;font-size:12px}
   .personalityScoreLabel b{color:#172033;font-size:13px}
   @media(max-width:900px){.personalityTraitGrid{grid-template-columns:1fr}.personalityTraitCard{min-height:0}}
   @media(max-width:600px){.personalityCompass{padding:0 14px 14px}.personalityCompassInner{padding:18px}.personalityCompassHeading h2{font-size:22px}.personalityTraitCard{padding:17px}}
  `}</style>
 </section>;
}
