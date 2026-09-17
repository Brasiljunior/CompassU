export const PERSONALITY_TRAITS = [
  { key:'structured', name:'Structured & Organized', questions:[36,46], description:'You tend to appreciate clear expectations, dependable routines, and environments where responsibilities are well defined. Structure can help you plan ahead, stay organized, and follow through consistently.' },
  { key:'adaptable', name:'Adaptable & Responsive', questions:[37,47], description:'You tend to be comfortable with variety, changing circumstances, and environments that move quickly. You may enjoy adjusting to new situations and responding to challenges as they arise.' },
  { key:'independent', name:'Independent', questions:[38], description:'You tend to be comfortable working on your own and taking responsibility for your individual work. You may appreciate having space to concentrate, make progress independently, and manage your own approach.' },
  { key:'social', name:'Socially Engaged & Communicative', questions:[39,50], description:'You tend to be comfortable engaging with other people and expressing yourself in social or group settings. Collaborative, public-facing, or communication-rich environments may feel especially natural to you.' },
  { key:'achievement', name:'Achievement-Oriented', questions:[40], description:'You tend to be motivated by meaningful goals, accomplishment, and opportunities to challenge yourself. You may enjoy environments where progress is visible and strong performance is encouraged.' },
  { key:'supportive', name:'Supportive & Patient', questions:[41], description:'You tend to show patience when helping other people understand, learn, or improve. Roles involving guidance, service, mentoring, teaching, or collaborative problem-solving may draw on this tendency.' },
  { key:'decisive', name:'Decisive Under Pressure', questions:[42], description:'You tend to be comfortable making decisions even when situations are important or demanding. You may be drawn to environments that require judgment, responsibility, and a willingness to act.' },
  { key:'enterprising', name:'Enterprising & Risk-Tolerant', questions:[43], description:'You tend to be open to calculated risks when the potential reward makes them worthwhile. You may enjoy opportunities that involve initiative, experimentation, entrepreneurship, or navigating uncertainty.' },
  { key:'analytical', name:'Analytical & Evidence-Based', questions:[44], description:'You tend to prefer facts, evidence, and careful reasoning when making decisions. You may enjoy work that involves evaluating information, identifying patterns, investigating questions, or solving problems logically.' },
  { key:'imaginative', name:'Imaginative & Creative', questions:[45], description:'You tend to enjoy imagining possibilities beyond what already exists. You may be energized by innovation, creative problem-solving, design, new ideas, or opportunities to envision different approaches.' },
  { key:'practical', name:'Practical & Hands-On', questions:[48], description:'You tend to enjoy tangible problems and practical application. You may prefer learning by doing and working on challenges where you can see concrete results from your effort.' },
  { key:'reflective', name:'Reflective & Ideas-Oriented', questions:[49], description:'You tend to enjoy thinking about people, society, ethics, and the ideas that shape human behavior. You may appreciate environments that encourage discussion, interpretation, reflection, and understanding different perspectives.' }
];

export function calculatePersonalityCompass(questionResponses=[]){
  const byNumber=new Map(questionResponses.map(r=>[Number(r.question_number),Number(r.value)]));
  return PERSONALITY_TRAITS.map(trait=>{
    const values=trait.questions.map(q=>byNumber.get(q)).filter(v=>Number.isFinite(v));
    if(!values.length)return null;
    const average=values.reduce((sum,v)=>sum+v,0)/values.length;
    const score=Math.round(((average-1)/4)*100);
    return {...trait,score,average:Number(average.toFixed(2)),indicatorCount:values.length};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||b.indicatorCount-a.indicatorCount||a.name.localeCompare(b.name)).slice(0,3);
}
