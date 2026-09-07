'use client';

const labelize=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const reportable=a=>(a||[]).filter(x=>!x?.suppressed);
const insight=(type,title,observation,implication)=>({type,title,observation,implication});

export function buildInstitutionalInsights(analytics){
 if(!analytics)return [];
 const p=analytics.participation||{},dims=reportable(analytics.dimensions),clusters=reportable(analytics.career_clusters),majors=reportable(analytics.top_majors),careers=reportable(analytics.top_careers),out=[];
 const assigned=Number(p.assigned_accounts||0),completed=Number(p.completed_students||0),started=Number(p.started_students||0),rate=Number(p.completion_rate||0);
 if(assigned){out.push(insight('participation','Assessment participation',`${completed} of ${assigned} assigned students have a completed assessment in this view (${rate}%).`,rate<60?'Consider outreach or workflow review before treating the current profile as broadly representative of assigned students.':'The completed-assessment base can support aggregate planning, while participation should continue to be monitored.'))}
 if(started>completed){out.push(insight('participation','Completion opportunity',`${Math.max(started-completed,0)} students represented here started but are not counted as completed.`,`Administrators may want to examine non-PII completion processes, reminders, and assessment access barriers.`))}
 if(dims.length){const sorted=[...dims].sort((a,b)=>Number(b.average_score||0)-Number(a.average_score||0)),hi=sorted[0],lo=sorted[sorted.length-1];out.push(insight('profile','Student profile pattern',`${labelize(hi.dimension)} is the highest reportable aggregate dimension at ${hi.average_score}%.${sorted.length>1?` ${labelize(lo.dimension)} is the lowest at ${lo.average_score}%.`:''}`,'Use the dimension pattern as a conversation starter for advising, student-support design, and pathway communications rather than as a measure of student ability.'))}
 if(clusters.length){const top=clusters[0],total=clusters.reduce((s,x)=>s+Number(x.student_count||0),0),share=total?Math.round(Number(top.student_count||0)*100/total):null;out.push(insight('pathways','Career-cluster concentration',`${labelize(top.cluster)} is the leading reportable career cluster with ${top.student_count} students${share!=null?` (${share}% of reportable cluster assignments)`:''}.`,'Review whether advising materials, experiential learning, and program pathway communications visibly support the strongest observed areas of student interest.'))}
 if(majors.length){const names=majors.slice(0,3).map(x=>x.major_name).join(', ');out.push(insight('academic','Major alignment signal',`The most recurring reportable major recommendations include ${names}.`,'Compare recurring recommendation patterns with current program pathways, transfer options, and advising resources. This describes student alignment patterns, not program demand forecasts.'))}
 if(careers.length){const names=careers.slice(0,3).map(x=>x.occupation_name).join(', ');out.push(insight('career','Career alignment signal',`The most recurring reportable career alignments include ${names}.`,'Consider whether career exploration, employer engagement, work-based learning, and pathway messaging adequately expose students to these observed career directions.'))}
 return out.slice(0,6);
}

export function buildTrendInsights(trends){
 const periods=trends?.periods||[],threshold=trends?.privacy?.small_cell_threshold??5,usable=periods.filter(p=>Number(p.participation?.completed_students||0)>=threshold),out=[];
 if(usable.length<2)return [insight('history','Limited longitudinal evidence',`Fewer than two reporting periods currently contain at least ${threshold} completed students.`,'Continue accumulating assessment history before interpreting changes as longitudinal patterns.')];
 const first=usable[0],last=usable[usable.length-1],a=Number(first.participation?.completion_rate||0),b=Number(last.participation?.completion_rate||0),delta=Math.round((b-a)*10)/10;
 out.push(insight('trend','Completion-rate movement',`Across the earliest and latest reportable periods, completion rate changed from ${a}% to ${b}% (${delta>0?'+':''}${delta} percentage points).`,'Use this descriptive movement to identify periods worth further operational review; it does not establish why completion changed.'));
 const dims=[...new Set(usable.flatMap(p=>reportable(p.dimensions).map(x=>x.dimension)))];let changes=[];dims.forEach(d=>{const x=reportable(first.dimensions).find(v=>v.dimension===d),y=reportable(last.dimensions).find(v=>v.dimension===d);if(x&&y)changes.push({d,delta:Math.round((Number(y.average_score)-Number(x.average_score))*10)/10})});changes.sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));if(changes[0])out.push(insight('trend','Profile movement',`${labelize(changes[0].d)} shows the largest reportable endpoint change at ${changes[0].delta>0?'+':''}${changes[0].delta} points.`,'Review the underlying period composition and advising context before drawing conclusions from profile movement.'));
 const latestClusters=reportable(last.career_clusters).slice(0,3);if(latestClusters.length)out.push(insight('trend','Current pathway signal',`The latest reportable period is led by ${latestClusters.map(x=>labelize(x.cluster)).join(', ')}.`,'Track whether these leading clusters persist across future periods before treating them as a stable planning signal.'));
 return out;
}
