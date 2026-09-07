'use client';

const safe=v=>String(v??'');
const labelize=v=>safe(v).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const cleanFile=v=>safe(v).replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'Institutional-Analytics';

export async function exportInstitutionalAnalyticsPdf({analytics,institution}){
  if(!analytics)throw new Error('Analytics are not loaded yet.');
  const {jsPDF}=await import('jspdf');
  const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter',compress:true});
  const W=612,H=792,M=46,CONTENT=W-(M*2);
  const navy=[15,29,64],blue=[47,111,237],violet=[111,92,255],gold=[244,183,64],ink=[23,32,51],muted=[102,112,133],line=[231,234,240],soft=[247,249,252],green=[25,118,75];
  let page=1;
  const scope=institution||analytics.institution||'All Institutions';
  const generated=analytics.generated_at?new Date(analytics.generated_at):new Date();
  const dims=(analytics.dimensions||[]).filter(x=>!x.suppressed);
  const clusters=(analytics.career_clusters||[]).filter(x=>!x.suppressed);
  const majors=(analytics.top_majors||[]).filter(x=>!x.suppressed);
  const careers=(analytics.top_careers||[]).filter(x=>!x.suppressed);
  const p=analytics.participation||{};
  const threshold=analytics?.privacy?.small_cell_threshold??5;

  const setText=(size,color=ink,style='normal')=>{doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(...color)};
  const footer=()=>{
    doc.setDrawColor(...line);doc.line(M,H-38,W-M,H-38);
    setText(8,muted);
    doc.text('CompassU Institutional Analytics • Aggregate decision-support reporting',M,H-22);
    doc.text(`Page ${page}`,W-M,H-22,{align:'right'});
  };
  const addPage=(title,kicker='INSTITUTIONAL ANALYTICS')=>{
    footer();doc.addPage();page+=1;
    doc.setFillColor(...navy);doc.rect(0,0,W,74,'F');
    setText(9,[195,210,255],'bold');doc.text(kicker,M,27);
    setText(21,[255,255,255],'bold');doc.text(title,M,54);
    return 104;
  };
  const wrapped=(text,x,y,width,size=10,color=muted,lineHeight=14,style='normal')=>{
    setText(size,color,style);const lines=doc.splitTextToSize(safe(text),width);doc.text(lines,x,y);return y+(lines.length*lineHeight);
  };
  const pill=(label,value,x,y,w)=>{
    doc.setFillColor(...soft);doc.roundedRect(x,y,w,70,10,10,'F');
    setText(9,muted,'bold');doc.text(label.toUpperCase(),x+12,y+20);
    setText(22,ink,'bold');doc.text(safe(value),x+12,y+50);
  };
  const section=(title,subtitle,y)=>{
    setText(16,ink,'bold');doc.text(title,M,y);
    if(subtitle)y=wrapped(subtitle,M,y+18,CONTENT,9,muted,12);
    return y+12;
  };
  const noData=(message,y)=>{
    doc.setFillColor(...soft);doc.roundedRect(M,y,CONTENT,52,9,9,'F');
    setText(10,muted);doc.text(message,M+14,y+30);return y+68;
  };
  const bar=(label,value,max,x,y,w=CONTENT)=>{
    const n=Number(value)||0;const maxN=Math.max(1,Number(max)||1);const bw=Math.max(3,(n/maxN)*(w-120));
    setText(10,ink,'bold');doc.text(label,x,y+11);
    setText(9,muted);doc.text(safe(value),x+w,y+11,{align:'right'});
    doc.setFillColor(235,239,246);doc.roundedRect(x+112,y+2,w-142,10,5,5,'F');
    doc.setFillColor(...blue);doc.roundedRect(x+112,y+2,Math.min(w-142,bw),10,5,5,'F');
    return y+28;
  };
  const tableHeader=(cols,y)=>{
    doc.setFillColor(248,250,252);doc.roundedRect(M,y,CONTENT,26,6,6,'F');
    setText(8,muted,'bold');
    cols.forEach(c=>doc.text(c.label,M+c.x,y+17,{align:c.align||'left'}));
    return y+34;
  };
  const rowLine=()=>{doc.setDrawColor(...line);};

  // Cover
  doc.setFillColor(...navy);doc.rect(0,0,W,H,'F');
  doc.setFillColor(...blue);doc.circle(W-72,74,48,'F');
  doc.setFillColor(...violet);doc.circle(W-35,117,28,'F');
  doc.setFillColor(...gold);doc.circle(W-95,145,10,'F');
  setText(15,[255,255,255],'bold');doc.text('✦  CompassU',M,82);
  setText(10,[195,210,255],'bold');doc.text('INSTITUTIONAL INTELLIGENCE',M,166);
  setText(34,[255,255,255],'bold');doc.text('Institutional',M,214);doc.text('Analytics Report',M,254);
  wrapped(scope,M,300,CONTENT-60,19,[255,255,255],24,'bold');
  doc.setFillColor(255,255,255);doc.setGState(new doc.GState({opacity:.08}));doc.roundedRect(M,380,CONTENT,176,18,18,'F');doc.setGState(new doc.GState({opacity:1}));
  setText(11,[195,210,255],'bold');doc.text('REPORT SCOPE',M+22,415);
  setText(16,[255,255,255],'bold');doc.text(scope,M+22,445);
  setText(10,[195,210,255]);doc.text(`Generated ${generated.toLocaleDateString()} at ${generated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,M+22,478);
  doc.text('Based on each student’s latest completed CompassU assessment.',M+22,505);
  doc.text(`Small-cell privacy threshold: fewer than ${threshold} students suppressed.`,M+22,528);
  setText(9,[195,210,255]);doc.text('Prepared for authorized institutional use.',M,H-58);

  // Executive overview
  let y=addPage('Executive Overview');
  y=section('Participation & Completion','A high-level view of institutional adoption and assessment completion.',y);
  const gap=10,box=(CONTENT-(gap*2))/3;
  pill('Assigned accounts',p.assigned_accounts??0,M,y,box);pill('Students started',p.started_students??0,M+box+gap,y,box);pill('Students completed',p.completed_students??0,M+(box+gap)*2,y,box);
  y+=84;
  pill('Completion rate',`${p.completion_rate??0}%`,M,y,box);pill('Not completed',p.not_completed_students??0,M+box+gap,y,box);pill('Privacy threshold',`< ${threshold}`,M+(box+gap)*2,y,box);
  y+=102;
  y=section('Executive Summary','What the current institutional data shows at a glance.',y);
  const strongest=dims.slice().sort((a,b)=>(b.average_score||0)-(a.average_score||0))[0];
  const topCluster=clusters[0],topMajor=majors[0],topCareer=careers[0];
  const insights=[];
  insights.push(`CompassU has ${p.assigned_accounts??0} assigned account${p.assigned_accounts===1?'':'s'}, with ${p.completed_students??0} student${p.completed_students===1?'':'s'} completing an assessment (${p.completion_rate??0}% completion).`);
  if(strongest)insights.push(`The highest average student-profile dimension is ${labelize(strongest.dimension)} at ${strongest.average_score}%.`);
  if(topCluster)insights.push(`The most common reportable career cluster is ${labelize(topCluster.cluster)} (${topCluster.student_count} students).`);
  if(topMajor)insights.push(`The most frequently recurring reportable major is ${topMajor.major_name}, appearing in ${topMajor.student_count} students’ Top 10 recommendations.`);
  if(topCareer)insights.push(`The leading reportable career alignment is ${topCareer.occupation_name}, connected to ${topCareer.student_count} students through their Top 3 recommended majors.`);
  insights.forEach((t,i)=>{doc.setFillColor(...soft);doc.roundedRect(M,y,CONTENT,48,8,8,'F');setText(9,blue,'bold');doc.text(`${i+1}`,M+14,y+27);y=wrapped(t,M+38,y+19,CONTENT-52,10,ink,13);y=Math.max(y+12,(y-13)+29);});

  // Dimensions + clusters
  y=addPage('Student Profile & Career Clusters');
  y=section('Student Profile — Six Dimensions','Average normalized scores for reportable dimensions.',y);
  if(!dims.length)y=noData('No reportable dimension data is available for this scope.',y);
  else{
    const max=100;
    dims.forEach(d=>{y=bar(labelize(d.dimension),`${d.average_score}%`,max,M,y);setText(7,muted);doc.text(`${d.student_count} students`,M+112,y-11);});
  }
  y+=16;
  y=section('Top Career Clusters','Dominant cluster distribution across students in the selected scope.',y);
  if(!clusters.length)y=noData('No career cluster reaches the current privacy reporting threshold.',y);
  else{
    const max=Math.max(...clusters.map(c=>c.student_count||0),1);
    clusters.slice(0,10).forEach(c=>{y=bar(labelize(c.cluster),c.student_count,max,M,y)});
  }

  // Majors
  y=addPage('Top Recommended Majors');
  y=section('Major Alignment','Counts how often each major appears anywhere in students’ Top 10 CompassU recommendations. Each student is counted once per major.',y);
  if(!majors.length)y=noData('No major reaches the current privacy reporting threshold.',y);
  else{
    y=tableHeader([{label:'MAJOR',x:10},{label:'STUDENTS',x:382,align:'right'},{label:'AVG. MATCH',x:500,align:'right'}],y);
    majors.slice(0,15).forEach((m,i)=>{
      if(y>720){y=addPage('Top Recommended Majors','INSTITUTIONAL ANALYTICS • CONTINUED');y=tableHeader([{label:'MAJOR',x:10},{label:'STUDENTS',x:382,align:'right'},{label:'AVG. MATCH',x:500,align:'right'}],y)}
      setText(10,ink,'bold');const name=doc.splitTextToSize(m.major_name||'—',315);doc.text(name,M+10,y+10);
      if(m.career_cluster){setText(8,muted);doc.text(labelize(m.career_cluster),M+10,y+28+(name.length-1)*11)}
      setText(10,ink);doc.text(safe(m.student_count??'—'),M+382,y+10,{align:'right'});doc.text(m.average_match_score==null?'—':`${m.average_match_score}%`,M+500,y+10,{align:'right'});
      const rh=Math.max(42,26+(name.length-1)*11);rowLine();doc.line(M,y+rh-6,W-M,y+rh-6);y+=rh;
    });
  }

  // Careers
  y=addPage('Top Career Alignments');
  y=section('Career Alignment','Recurring careers connected to students’ Top 3 recommended majors. Each student is counted once per career.',y);
  if(!careers.length)y=noData('No career reaches the current privacy reporting threshold.',y);
  else{
    y=tableHeader([{label:'CAREER',x:10},{label:'SOC',x:365},{label:'STUDENTS',x:500,align:'right'}],y);
    careers.slice(0,18).forEach(c=>{
      if(y>720){y=addPage('Top Career Alignments','INSTITUTIONAL ANALYTICS • CONTINUED');y=tableHeader([{label:'CAREER',x:10},{label:'SOC',x:365},{label:'STUDENTS',x:500,align:'right'}],y)}
      setText(10,ink,'bold');const name=doc.splitTextToSize(c.occupation_name||'—',320);doc.text(name,M+10,y+10);
      setText(9,muted);doc.text(c.soc_code||'—',M+365,y+10);setText(10,ink);doc.text(safe(c.student_count??'—'),M+500,y+10,{align:'right'});
      const rh=Math.max(34,22+(name.length-1)*11);rowLine();doc.line(M,y+rh-5,W-M,y+rh-5);y+=rh;
    });
  }

  // Methodology
  y=addPage('Methodology & Data Definitions');
  const methods=[
    ['Reporting scope',scope],
    ['Assessment basis','Each student contributes only their latest completed CompassU assessment.'],
    ['Participation','Assigned accounts are users with an institution assignment. Started students have at least one assessment attempt; completed students have at least one completed assessment.'],
    ['Student profile','Dimension scores are normalized to a 0–100 scale from CompassU assessment responses and averaged across reportable students.'],
    ['Career clusters','Career-cluster reporting summarizes the dominant cluster for each student from assessment scoring-key data.'],
    ['Recommended majors','Major counts reflect how often a major appears in students’ Top 10 CompassU recommendations, counting a student at most once per major.'],
    ['Career alignments','Career counts reflect occupations linked to students’ Top 3 recommended majors, counting a student at most once per career.'],
    ['Privacy safeguard',`Aggregate categories representing fewer than ${threshold} students are suppressed from reportable outputs.`],
    ['Use of report','CompassU is an educational decision-support and career-exploration tool. Institutional analytics should be interpreted as aggregate guidance rather than a clinical, psychological, or deterministic assessment.']
  ];
  methods.forEach(([k,v])=>{setText(10,blue,'bold');doc.text(k,M,y);y=wrapped(v,M,y+17,CONTENT,10,ink,14);y+=18;if(y>710)y=addPage('Methodology & Data Definitions','INSTITUTIONAL ANALYTICS • CONTINUED')});
  y+=8;doc.setFillColor(...navy);doc.roundedRect(M,y,CONTENT,72,10,10,'F');setText(11,[255,255,255],'bold');doc.text('CompassU • Institutional Intelligence',M+16,y+26);setText(9,[205,216,244]);doc.text('Aggregate insight for advising, pathway planning, student success, and academic strategy.',M+16,y+48);

  footer();
  const filename=`CompassU-${cleanFile(scope)}-Institutional-Analytics-${generated.toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
  return filename;
}
