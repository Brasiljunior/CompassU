'use client';

const safe=v=>String(v??'');
const cleanFile=v=>safe(v).replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'All-Institutions';

export async function exportExecutiveInstitutionalInsightsPdf({institution,current,longitudinal,threshold=5}){
  if(!current?.length&&!longitudinal?.length)throw new Error('Generate executive insights before exporting.');
  const {jsPDF}=await import('jspdf');
  const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'letter',compress:true});
  const W=612,H=792,M=46,CONTENT=W-(M*2),navy=[15,29,64],blue=[47,111,237],ink=[23,32,51],muted=[102,112,133],line=[231,234,240],soft=[248,250,252];let page=1,y=0;
  const setText=(size,color=ink,style='normal')=>{doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(...color)};
  const footer=()=>{doc.setDrawColor(...line);doc.line(M,H-34,W-M,H-34);setText(7,muted);doc.text('CompassU Executive Institutional Insights | Aggregate decision-support reporting',M,H-20);doc.text(`Page ${page}`,W-M,H-20,{align:'right'})};
  const addPage=(title)=>{if(page>0)footer();doc.addPage();page++;doc.setFillColor(...navy);doc.rect(0,0,W,60,'F');setText(8,[195,210,255],'bold');doc.text('EXECUTIVE INSTITUTIONAL INSIGHTS',M,22);setText(18,[255,255,255],'bold');doc.text(title,M,43);return 86};
  const wrapped=(text,x,yy,width,size=9,color=ink,lineHeight=13,style='normal')=>{setText(size,color,style);const lines=doc.splitTextToSize(safe(text),width);doc.text(lines,x,yy);return yy+lines.length*lineHeight};
  const drawInsight=(item,yy)=>{const obsLines=doc.splitTextToSize(safe(item.observation),CONTENT-28),impLines=doc.splitTextToSize(safe(item.implication),CONTENT-28),height=72+(obsLines.length+impLines.length)*12;if(yy+height>H-60)yy=addPage('Insights — Continued');doc.setFillColor(...soft);doc.setDrawColor(...line);doc.roundedRect(M,yy,CONTENT,height,10,10,'FD');setText(7,blue,'bold');doc.text(safe(item.type).toUpperCase(),M+14,yy+18);setText(12,ink,'bold');doc.text(safe(item.title),M+14,yy+36);setText(9,ink);doc.text(obsLines,M+14,yy+54);let cy=yy+54+obsLines.length*12+8;setText(8,muted,'bold');doc.text('PLANNING CONSIDERATION',M+14,cy);cy+=14;setText(8.5,muted);doc.text(impLines,M+14,cy);return yy+height+12};

  doc.setFillColor(...navy);doc.rect(0,0,W,H,'F');doc.setFillColor(...blue);doc.circle(W-68,68,36,'F');setText(14,[255,255,255],'bold');doc.text('CompassU',M,70);setText(9,[195,210,255],'bold');doc.text('INSTITUTIONAL INTELLIGENCE',M,132);setText(29,[255,255,255],'bold');doc.text('Executive Institutional Insights',M,172);setText(14,[205,216,244]);doc.text(institution||'All Institutions',M,205);doc.setFillColor(31,48,89);doc.roundedRect(M,248,CONTENT,180,14,14,'F');setText(9,[195,210,255],'bold');doc.text('REPORT PURPOSE',M+18,276);wrapped('Evidence-based observations and planning considerations derived from CompassU aggregate assessment analytics.',M+18,298,CONTENT-36,11,[255,255,255],16);setText(9,[195,210,255],'bold');doc.text('INTERPRETATION SAFEGUARD',M+18,350);wrapped('Insights are descriptive. They do not establish causation, predict individual outcomes, evaluate student ability, or replace institutional research.',M+18,372,CONTENT-36,10,[255,255,255],15);setText(8,[195,210,255]);doc.text(`Privacy threshold: categories representing fewer than ${threshold} students remain suppressed.`,M+18,411);

  y=addPage('Current Institutional Signals');
  if(current?.length){current.forEach(item=>{y=drawInsight(item,y)})}else y=wrapped('No current institutional signals are available.',M,y,CONTENT,10,muted,14);
  y=addPage('Longitudinal Signals');
  if(longitudinal?.length){longitudinal.forEach(item=>{y=drawInsight(item,y)})}else y=wrapped('No longitudinal signals are available.',M,y,CONTENT,10,muted,14);
  if(y>H-180)y=addPage('Methodology & Appropriate Use');
  setText(14,ink,'bold');doc.text('Methodology & Appropriate Use',M,y);y+=22;
  const notes=[['Evidence basis','Insights are generated from aggregate CompassU institutional analytics and trend outputs already subject to small-cell suppression.'],['Current signals','Current observations summarize participation, student profile, career-cluster, major, and career alignment patterns in the selected institutional view.'],['Longitudinal signals','Trend observations compare consecutive reporting periods and should be interpreted as descriptive institutional patterns, not student-level progression or causal change.'],['Privacy',`Categories representing fewer than ${threshold} students are suppressed in underlying analytics and are not surfaced as executive insights.`],['Decision support','Planning considerations are intended to prompt inquiry, advising review, pathway discussion, and institutional planning. They are not recommendations about individual students.']];
  notes.forEach(([k,v])=>{if(y>H-90)y=addPage('Methodology — Continued');setText(9,blue,'bold');doc.text(k,M,y);y=wrapped(v,M,y+14,CONTENT,9,ink,12);y+=12});
  footer();
  const filename=`CompassU-Executive-Institutional-Insights-${cleanFile(institution||'All-Institutions')}.pdf`;doc.save(filename);return filename;
}
