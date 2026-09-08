import { jsPDF } from 'jspdf';

const safe=v=>String(v??'');
const labelize=v=>safe(v).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const reportable=a=>(a||[]).filter(x=>!x?.suppressed);
const pdfBuffer=doc=>Buffer.from(doc.output('arraybuffer'));

function baseDoc({landscape=false}={}){
  const doc=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'pt',format:'letter',compress:true});
  const W=landscape?792:612,H=landscape?612:792,M=44,navy=[15,29,64],blue=[47,111,237],ink=[23,32,51],muted=[102,112,133],line=[231,234,240],soft=[247,249,252];
  const set=(size,color=ink,style='normal')=>{doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(...color)};
  const header=(title,kicker='COMPASSU INSTITUTIONAL INTELLIGENCE')=>{doc.setFillColor(...navy);doc.rect(0,0,W,70,'F');set(8,[195,210,255],'bold');doc.text(kicker,M,25);set(20,[255,255,255],'bold');doc.text(title,M,51);};
  const footer=(text='CompassU | Aggregate decision-support reporting')=>{doc.setDrawColor(...line);doc.line(M,H-34,W-M,H-34);set(7,muted);doc.text(text,M,H-20);};
  const wrap=(text,x,y,width,size=9,color=ink,lineHeight=13,style='normal')=>{set(size,color,style);const lines=doc.splitTextToSize(safe(text),width);doc.text(lines,x,y);return y+lines.length*lineHeight;};
  return {doc,W,H,M,navy,blue,ink,muted,line,soft,set,header,footer,wrap};
}

export function buildMonthlyAnalyticsPdf({analytics,institution,periodLabel}){
  const {doc,W,M,blue,ink,muted,soft,set,header,footer,wrap}=baseDoc();
  header('Institutional Analytics');
  set(15,ink,'bold');doc.text(institution,M,108);set(10,muted);doc.text(periodLabel,M,126);
  const p=analytics?.participation||{};const dims=reportable(analytics?.dimensions),clusters=reportable(analytics?.career_clusters),majors=reportable(analytics?.top_majors),careers=reportable(analytics?.top_careers),threshold=analytics?.privacy?.small_cell_threshold??5;
  const cards=[['Assigned accounts',p.assigned_accounts??0],['Started',p.started_students??0],['Completed',p.completed_students??0],['Completion rate',`${p.completion_rate??0}%`]];
  let x=M,y=154;cards.forEach(([k,v],i)=>{const w=120;doc.setFillColor(...soft);doc.roundedRect(x+i*(w+10),y,w,58,8,8,'F');set(8,muted,'bold');doc.text(k.toUpperCase(),x+10+i*(w+10),y+18);set(20,ink,'bold');doc.text(safe(v),x+10+i*(w+10),y+43)});
  y=242;set(14,ink,'bold');doc.text('Student Profile',M,y);y+=20;dims.slice(0,6).forEach(d=>{set(9,ink,'bold');doc.text(labelize(d.dimension),M,y);set(9,blue,'bold');doc.text(`${d.average_score}%`,W-M,y,{align:'right'});y+=22});if(!dims.length)y=wrap('No reportable profile cells for this period.',M,y,W-M*2,9,muted,13);
  y+=12;set(14,ink,'bold');doc.text('Top Career Clusters',M,y);y+=20;clusters.slice(0,6).forEach(c=>{set(9,ink);doc.text(labelize(c.cluster),M,y);set(9,muted);doc.text(`${c.student_count} students`,W-M,y,{align:'right'});y+=20});if(!clusters.length)y=wrap('No career-cluster cells meet the privacy threshold.',M,y,W-M*2,9,muted,13);
  doc.addPage();header('Major & Career Alignment');y=104;set(14,ink,'bold');doc.text('Top Recommended Majors',M,y);y+=22;majors.slice(0,12).forEach((m,i)=>{set(9,ink,i<3?'bold':'normal');doc.text(`${i+1}. ${m.major_name}`,M,y);set(9,muted);doc.text(`${m.student_count} students`,W-M,y,{align:'right'});y+=20});if(!majors.length)y=wrap('No major cells meet the privacy threshold.',M,y,W-M*2,9,muted,13);
  y+=18;set(14,ink,'bold');doc.text('Top Career Alignments',M,y);y+=22;careers.slice(0,12).forEach((c,i)=>{set(9,ink,i<3?'bold':'normal');doc.text(`${i+1}. ${c.occupation_name}`,M,y);set(9,muted);doc.text(`${c.student_count} students`,W-M,y,{align:'right'});y+=20});if(!careers.length)y=wrap('No career cells meet the privacy threshold.',M,y,W-M*2,9,muted,13);
  y+=18;doc.setFillColor(...soft);doc.roundedRect(M,y,W-M*2,70,8,8,'F');wrap(`Privacy safeguard: aggregate categories representing fewer than ${threshold} students are suppressed. This monthly report reflects each student's latest completed CompassU assessment when that assessment falls within the reporting period.`,M+12,y+22,W-M*2-24,8.5,muted,12);
  footer();return pdfBuffer(doc);
}

export function buildMonthlyTrendsPdf({trends,institution,periodLabel}){
  const {doc,W,M,blue,ink,muted,soft,set,header,footer,wrap}=baseDoc({landscape:true});header('Institutional Trends');set(14,ink,'bold');doc.text(institution,M,105);set(10,muted);doc.text(`Monthly trend view through ${periodLabel}`,M,123);
  const periods=trends?.periods||[],threshold=trends?.privacy?.small_cell_threshold??5;let y=154;set(13,ink,'bold');doc.text('Participation & Completion',M,y);y+=24;const cw=(W-M*2-150)/Math.max(periods.length,1);set(8,muted,'bold');doc.text('METRIC',M,y);periods.forEach((p,i)=>doc.text(`${p.period_start.slice(5)}–${p.period_end.slice(5)}`,M+150+i*cw,y));y+=18;[['Assigned','assigned_accounts'],['Started','started_students'],['Completed','completed_students'],['Completion rate','completion_rate']].forEach(([label,key])=>{set(9,ink,'bold');doc.text(label,M,y);periods.forEach((p,i)=>{let v=p.participation?.[key]??0;if(key==='completion_rate')v=`${v}%`;set(9,ink);doc.text(safe(v),M+150+i*cw,y)});y+=22});
  y+=16;set(13,ink,'bold');doc.text('Leading Career Clusters by Period',M,y);y+=24;periods.forEach((p,i)=>{const x=M+i*((W-M*2)/Math.max(periods.length,1)),box=(W-M*2)/Math.max(periods.length,1)-8;doc.setFillColor(...soft);doc.roundedRect(x,y,box,150,8,8,'F');set(8,ink,'bold');doc.text(`${p.period_start} – ${p.period_end}`,x+10,y+18);let cy=y+40;const items=reportable(p.career_clusters).slice(0,4);if(!items.length){set(8,muted);doc.text('No reportable cells',x+10,cy)}else items.forEach((c,n)=>{cy=wrap(`${n+1}. ${labelize(c.cluster)} — ${c.student_count}`,x+10,cy,box-20,8,ink,11,n<2?'bold':'normal')+4})});
  y+=176;doc.setFillColor(...soft);doc.roundedRect(M,y,W-M*2,52,8,8,'F');wrap(`Trend reporting uses consecutive monthly periods and inherits CompassU's small-cell suppression threshold of ${threshold}. Results are descriptive and should not be interpreted as causal institutional performance measures.`,M+12,y+20,W-M*2-24,8.5,muted,12);footer('CompassU Institutional Trends | Aggregate longitudinal decision-support reporting');return pdfBuffer(doc);
}

function insightsFrom({analytics,trends}){
  const out=[],p=analytics?.participation||{},dims=reportable(analytics?.dimensions),clusters=reportable(analytics?.career_clusters),majors=reportable(analytics?.top_majors),periods=trends?.periods||[];
  out.push({title:'Monthly participation',text:`${p.completed_students??0} students completed a CompassU assessment in the monthly reporting scope, representing a ${p.completion_rate??0}% completion rate among assigned accounts.`});
  if(dims.length){const s=[...dims].sort((a,b)=>(b.average_score||0)-(a.average_score||0));out.push({title:'Student profile signal',text:`${labelize(s[0].dimension)} is the highest reportable aggregate profile dimension at ${s[0].average_score}%.`})}
  if(clusters.length)out.push({title:'Career-cluster signal',text:`${labelize(clusters[0].cluster)} is the leading reportable career cluster with ${clusters[0].student_count} students.`});
  if(majors.length)out.push({title:'Major alignment signal',text:`Recurring reportable major recommendations include ${majors.slice(0,3).map(x=>x.major_name).join(', ')}.`});
  const usable=periods.filter(x=>Number(x.participation?.completed_students||0)>=5);if(usable.length>=2){const a=Number(usable[0].participation?.completion_rate||0),b=Number(usable.at(-1).participation?.completion_rate||0);out.push({title:'Longitudinal participation signal',text:`Across the earliest and latest reportable monthly periods shown, completion rate moved from ${a}% to ${b}%.`})}
  return out;
}

export function buildMonthlyExecutivePdf({analytics,trends,institution,periodLabel}){
  const {doc,W,M,ink,muted,soft,blue,set,header,footer,wrap}=baseDoc();header('Executive Institutional Insights');set(15,ink,'bold');doc.text(institution,M,108);set(10,muted);doc.text(periodLabel,M,126);let y=158;const items=insightsFrom({analytics,trends});items.forEach((item,i)=>{const lines=doc.splitTextToSize(item.text,W-M*2-28),h=58+lines.length*12;doc.setFillColor(...soft);doc.roundedRect(M,y,W-M*2,h,9,9,'F');set(8,blue,'bold');doc.text(`SIGNAL ${i+1}`,M+14,y+18);set(12,ink,'bold');doc.text(item.title,M+14,y+37);set(9,ink);doc.text(lines,M+14,y+55);y+=h+12;if(y>680&&i<items.length-1){doc.addPage();header('Executive Insights — Continued');y=100}});if(!items.length)y=wrap('No executive insights are available for this reporting period.',M,y,W-M*2,10,muted,14);
  if(y>610){doc.addPage();header('Appropriate Use');y=106}else y+=14;doc.setFillColor(...soft);doc.roundedRect(M,y,W-M*2,110,9,9,'F');set(10,ink,'bold');doc.text('Interpretation safeguard',M+14,y+24);wrap('These observations summarize aggregate CompassU assessment patterns. They support inquiry and planning; they do not establish causation, predict individual outcomes, evaluate student ability, or replace institutional research. Small-cell suppression remains in force.',M+14,y+44,W-M*2-28,9,muted,13);footer('CompassU Executive Institutional Insights | Aggregate decision-support reporting');return pdfBuffer(doc);
}
