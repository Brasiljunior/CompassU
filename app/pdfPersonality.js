import { calculatePersonalityCompass } from './personalityCompass';

function normalizeTraits(traits){
  if(!Array.isArray(traits))return [];
  return traits.map((trait,index)=>{
    const name=trait?.name||trait?.trait_name;
    const description=trait?.description||trait?.trait_description;
    return name&&description?{...trait,key:trait?.key||`trait-${index}`,name,description}:null;
  }).filter(Boolean).slice(0,3);
}

function visiblePersonalityCompass(){
  if(typeof document==='undefined')return [];
  try{
    const cards=[...document.querySelectorAll('.personalityTraitCard')];
    const traits=cards.map((card,index)=>{
      const name=card.querySelector('h3')?.textContent?.trim();
      const paragraphs=[...card.querySelectorAll('p')].map(p=>p.textContent?.trim()).filter(Boolean);
      const description=paragraphs[0];
      return name&&description?{key:`visible-${index}`,name,description}:null;
    }).filter(Boolean);
    return traits.length>=3?traits.slice(0,3):[];
  }catch{return []}
}

export function cachePdfPersonalityCompass(traits){
  const normalized=normalizeTraits(traits);
  if(typeof window!=='undefined'&&normalized.length>=3){
    try{
      localStorage.setItem('compassu_personality_traits',JSON.stringify(normalized));
      sessionStorage.setItem('compassu_personality_traits',JSON.stringify(normalized));
    }catch{}
  }
  return normalized;
}

export async function loadPdfPersonalityCompass(session,providedTraits=[]){
  try{
    const provided=normalizeTraits(providedTraits);
    if(provided.length>=3)return cachePdfPersonalityCompass(provided);
    const visible=visiblePersonalityCompass();
    if(visible.length>=3)return cachePdfPersonalityCompass(visible);
    if(typeof window!=='undefined'){
      for(const storage of [sessionStorage,localStorage]){
        try{
          const cached=normalizeTraits(JSON.parse(storage.getItem('compassu_personality_traits')||'null'));
          if(cached.length>=3)return cached;
        }catch{}
      }
    }
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const token=session?.access_token,uid=session?.user?.id;
    if(!url||!key||!token||!uid)return [];
    const headers={apikey:key,Authorization:`Bearer ${token}`};
    const ar=await fetch(`${url}/rest/v1/assessment_attempts?user_id=eq.${uid}&status=eq.completed&select=id&order=completed_at.desc&limit=1`,{headers});
    if(!ar.ok)return [];
    const attempts=await ar.json(),aid=attempts?.[0]?.id;
    if(!aid)return [];
    const qr=await fetch(`${url}/rest/v1/assessment_questions?question_number=gte.36&question_number=lte.50&select=id,question_number`,{headers});
    if(!qr.ok)return [];
    const questions=await qr.json();
    const numberById=new Map((questions||[]).map(q=>[String(q.id),Number(q.question_number)]));
    const ids=(questions||[]).map(q=>q.id).join(',');
    if(!ids)return [];
    const rr=await fetch(`${url}/rest/v1/assessment_responses?attempt_id=eq.${aid}&question_id=in.(${ids})&select=question_id,response_value`,{headers});
    if(!rr.ok)return [];
    const rows=await rr.json();
    const calculated=calculatePersonalityCompass((rows||[]).map(r=>({question_number:numberById.get(String(r.question_id)),value:Number(r.response_value?.value)})).filter(r=>Number.isFinite(r.question_number)&&Number.isFinite(r.value)));
    return cachePdfPersonalityCompass(calculated);
  }catch(error){console.error('Personality Compass PDF data could not load',error);return []}
}

export function addPersonalityCompassPdfPage(pdf,traits,helpers,pageNumber=3){
  const normalized=normalizeTraits(traits);
  if(normalized.length<3)return false;
  const {C,tx,wr,box,line,badge,compass,footer}=helpers;
  pdf.addPage();
  tx('YOUR PERSONALITY COMPASS',14,18,17,C.navy,'bold');
  line(91,14,281,14,C.purple,.8);compass(288,14,5.5);
  wr('Based on your CompassU responses, these are three personality tendencies that stand out most strongly. They describe patterns in how you may prefer to work, learn, communicate, and approach decisions—not fixed labels or a clinical personality assessment.',14,29,266,9.5,C.ink,'normal',4);
  const colors=[C.purple,C.blue,C.green];
  normalized.forEach((trait,i)=>{
    const x=14+i*91;
    box(x,52,83,116,i===0?C.lav:[255,255,255],5);
    badge(x+12,67,7,colors[i],String(i+1));
    wr(trait.name,x+23,62,52,12,C.navy,'bold',3);
    tx('PERSONALITY TENDENCY',x+9,91,7.5,colors[i],'bold');
    wr(trait.description,x+9,102,65,9,C.ink,'normal',8);
  });
  box(14,176,265,12,C.pale,3);
  tx('Use these tendencies as reflection points when exploring majors, careers, learning environments, and future opportunities.',146.5,183.5,8,C.muted,'bold',{align:'center'});
  footer(pageNumber);
  return true;
}
