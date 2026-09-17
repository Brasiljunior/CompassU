'use client';

import { useEffect, useState } from 'react';
import { calculatePersonalityCompass } from './personalityCompass';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function PersonalityCompassPanel(){
 const[traits,setTraits]=useState([]);
 useEffect(()=>{
  let cancelled=false;
  async function load(){
   try{
    const session=JSON.parse(localStorage.getItem('compassu_session')||'null');
    if(!session?.user?.id||!session?.access_token||!SUPABASE_URL||!SUPABASE_KEY)return;
    const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`};
    const attempts=await fetch(`${SUPABASE_URL}/rest/v1/assessment_attempts?user_id=eq.${session.user.id}&status=eq.completed&select=id&order=completed_at.desc&limit=1`,{headers}).then(r=>r.ok?r.json():[]);
    if(!attempts?.[0]?.id)return;
    const rows=await fetch(`${SUPABASE_URL}/rest/v1/assessment_responses?attempt_id=eq.${attempts[0].id}&select=response_value,assessment_questions!inner(question_number,dimension)&assessment_questions.dimension=eq.personality`,{headers}).then(r=>r.ok?r.json():[]);
    const responses=(Array.isArray(rows)?rows:[]).map(r=>({question_number:r.assessment_questions?.question_number,value:r.response_value?.value}));
    const top=calculatePersonalityCompass(responses);
    if(!cancelled)setTraits(top);
   }catch(error){console.error('Personality Compass could not load',error)}
  }
  load();
  const refresh=()=>load();
  window.addEventListener('focus',refresh);
  return()=>{cancelled=true;window.removeEventListener('focus',refresh)};
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
 </section>;
}
