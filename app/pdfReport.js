export async function generateCompassUPdf({matches=[],selectedMajor=null,traits=[],careers=[],session=null}){
  if(!matches.length)return;
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  const W=210;
  const navy=[15,29,64],blue=[47,111,237],purple=[111,92,255],gold=[244,183,64],ink=[23,32,51],muted=[88,101,122],pale=[243,247,255],green=[25,118,75],line=[224,231,242];
  const firstName=session?.user?.user_metadata?.first_name||'Student';
  const top=matches.slice(0,5);
  const selected=selectedMajor||top[0];
  const careerRows=careers.map(r=>r.occupations||{}).filter(o=>o.name).slice(0,8);
  const traitRows=traits.slice(0,6);
  const money=value=>value==null?'Unavailable':`$${Number(value).toLocaleString()}`;

  const text=(value,x,y,size=10,color=ink,style='normal',options={})=>{pdf.setFont('helvetica',style);pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(String(value??''),x,y,options)};
  const wrapped=(value,x,y,width,size=9,color=muted,style='normal',lineHeight=4.5)=>{pdf.setFont('helvetica',style);pdf.setFontSize(size);pdf.setTextColor(...color);const lines=pdf.splitTextToSize(String(value??''),width);pdf.text(lines,x,y);return y+lines.length*lineHeight};
  const card=(x,y,w,h,fill=[255,255,255],stroke=line,r=4)=>{pdf.setFillColor(...fill);pdf.setDrawColor(...stroke);pdf.setLineWidth(.45);pdf.roundedRect(x,y,w,h,r,r,'FD');};
  const footer=page=>{pdf.setDrawColor(...line);pdf.line(14,280,196,280);text('CompassU  •  Discover. Plan. Succeed.  •  getcompassu.com',14,286,7.2,muted,'bold');text(`Personalized Career Pathway Results  •  Page ${page}`,196,286,7.2,muted,'normal',{align:'right'});text('Educational decision-support tool. Career and college data are informed by federal CIP, BLS, and IPEDS sources.',14,291,6.4,[112,122,139]);};
  const compassMark=(cx,cy,r)=>{pdf.setFillColor(...blue);pdf.circle(cx,cy,r,'F');pdf.setDrawColor(255,255,255);pdf.setLineWidth(.7);pdf.circle(cx,cy,r-2,'S');pdf.setFillColor(255,255,255);pdf.triangle(cx,cy-r+3,cx-2.2,cy+1,cx+2.2,cy+1,'F');pdf.setFillColor(...gold);pdf.triangle(cx,cy+r-3,cx-2.2,cy-1,cx+2.2,cy-1,'F');text('N',cx,cy-r-1.5,5.2,[255,255,255],'bold',{align:'center'});};
  const pill=(value,x,y,w,fill,color=[255,255,255])=>{pdf.setFillColor(...fill);pdf.roundedRect(x,y,w,7,3.5,3.5,'F');text(value,x+w/2,y+4.8,6.5,color,'bold',{align:'center'});};

  const makeIllustration=(variant='journey')=>{
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=720;const c=canvas.getContext('2d');
    const g=c.createLinearGradient(0,0,0,720);g.addColorStop(0,'#dfeaff');g.addColorStop(.55,'#f7f9ff');g.addColorStop(1,'#fff8e8');c.fillStyle=g;c.fillRect(0,0,1200,720);
    c.fillStyle='#ffe29a';c.beginPath();c.arc(930,145,78,0,Math.PI*2);c.fill();
    c.fillStyle='#b6c9ee';c.beginPath();c.moveTo(0,500);c.lineTo(300,190);c.lineTo(555,500);c.closePath();c.fill();
    c.fillStyle='#7797cf';c.beginPath();c.moveTo(240,500);c.lineTo(610,115);c.lineTo(930,500);c.closePath();c.fill();
    c.fillStyle='#456fae';c.beginPath();c.moveTo(650,500);c.lineTo(925,235);c.lineTo(1200,500);c.closePath();c.fill();
    c.fillStyle='#eef3fb';c.fillRect(0,500,1200,220);
    c.strokeStyle='#f4b740';c.lineWidth=34;c.lineCap='round';c.beginPath();c.moveTo(570,720);c.bezierCurveTo(600,625,710,590,780,520);c.bezierCurveTo(845,455,900,420,1010,390);c.stroke();
    c.strokeStyle='#fff7da';c.lineWidth=8;c.beginPath();c.moveTo(570,720);c.bezierCurveTo(600,625,710,590,780,520);c.bezierCurveTo(845,455,900,420,1010,390);c.stroke();
    c.fillStyle='#0f1d40';c.beginPath();c.arc(520,515,24,0,Math.PI*2);c.fill();c.fillRect(503,538,34,92);c.strokeStyle='#0f1d40';c.lineWidth=18;c.lineCap='round';c.beginPath();c.moveTo(510,625);c.lineTo(480,690);c.moveTo(530,625);c.lineTo(565,690);c.moveTo(505,555);c.lineTo(460,605);c.moveTo(535,555);c.lineTo(575,595);c.stroke();
    c.fillStyle='#2f6fed';c.fillRect(475,548,32,57);c.fillStyle='#6f5cff';c.beginPath();c.arc(493,570,24,0,Math.PI*2);c.fill();
    if(variant==='action'){
      c.fillStyle='#ffffff';c.strokeStyle='#cfd9ed';c.lineWidth=5;c.beginPath();c.roundRect(65,85,360,185,28);c.fill();c.stroke();
      c.fillStyle='#0f1d40';c.font='700 34px Arial';c.fillText('YOUR NEXT MOVE',100,140);c.font='26px Arial';c.fillStyle='#56657a';c.fillText('Explore',100,190);c.fillText('Compare',100,228);c.fillStyle='#2f6fed';c.fillRect(285,172,95,12);c.fillStyle='#6f5cff';c.fillRect(285,210,125,12);
    }else{
      c.fillStyle='#2f6fed';c.beginPath();c.arc(130,130,76,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=8;c.beginPath();c.arc(130,130,58,0,Math.PI*2);c.stroke();c.fillStyle='#fff';c.beginPath();c.moveTo(130,72);c.lineTo(108,138);c.lineTo(130,126);c.lineTo(152,138);c.closePath();c.fill();c.fillStyle='#f4b740';c.beginPath();c.moveTo(130,188);c.lineTo(108,122);c.lineTo(130,134);c.lineTo(152,122);c.closePath();c.fill();
    }
    return canvas.toDataURL('image/png',.92);
  };

  const heroImage=makeIllustration('journey');
  const actionImage=makeIllustration('action');

  // PAGE 1 — editorial cover + strongest directions
  pdf.setFillColor(...navy);pdf.rect(0,0,W,86,'F');pdf.setFillColor(...blue);pdf.rect(0,0,6,86,'F');
  compassMark(22,19,8.5);text('CompassU',37,17.5,22,[255,255,255],'bold');text('DISCOVER  •  PLAN  •  SUCCEED',37,26,7.2,[202,217,255],'bold');
  pill('PERSONALIZED RESULTS',14,37,42,[39,66,120]);
  text('Your Career Pathway',14,56,19,[255,255,255],'bold');text('Roadmap',14,68,24,[255,255,255],'bold');text(`Prepared for ${firstName}`,14,78,9,[222,231,255]);
  pdf.addImage(heroImage,'PNG',112,15,84,58,undefined,'FAST');
  pdf.setFillColor(...gold);pdf.rect(14,90,182,2.2,'F');

  text('Your direction is coming into focus.',14,108,16,ink,'bold');
  wrapped('CompassU turns your 80-question assessment into a practical, personalized roadmap. These results are a compass, not a command - use them to explore majors, careers, and destinations that fit who you are.',14,117,182,9.2,muted,'normal',4.5);

  const best=top[0];
  card(14,139,55,30,[239,244,255]);card(77.5,139,55,30,[247,244,255]);card(141,139,55,30,[255,249,234]);
  text('TOP ALIGNMENT',19,148,6.8,blue,'bold');text(best?`${Number(best.match_score).toFixed(0)}%`:'-',19,160,17,ink,'bold');text('strongest major match',19,166,6.8,muted);
  text('DIRECTIONS',82.5,148,6.8,purple,'bold');text(String(matches.length),82.5,160,17,ink,'bold');text('ranked major matches',82.5,166,6.8,muted);
  text('ASSESSMENT',146,148,6.8,[177,122,16],'bold');text('80',146,160,17,ink,'bold');text('insights reviewed',146,166,6.8,muted);

  text('Your Strongest Directions',14,184,14.5,ink,'bold');text('Top five major matches by alignment with your multidimensional profile',14,191,7.8,muted);
  let y=199;
  top.forEach((m,i)=>{const isTop=i===0;card(14,y,182,13.5,isTop?[235,242,255]:[250,251,253]);pdf.setFillColor(...(isTop?blue:[205,216,238]));pdf.circle(23,y+6.75,4.1,'F');text(String(m.rank),23,y+8.2,7.5,[255,255,255],'bold',{align:'center'});const name=pdf.splitTextToSize(m.major_name,112);text(name[0],31,y+5.8,8.8,ink,'bold');text(isTop?'Your strongest current direction':'A strong path worth exploring',31,y+10.7,6.5,muted);text(`${Number(m.match_score).toFixed(0)}%`,190,y+8,9.5,isTop?green:blue,'bold',{align:'right'});y+=15.5;});
  pdf.setFillColor(...navy);pdf.roundedRect(14,259,182,12,4,4,'F');text('YOUR FUTURE HAS A DIRECTION.',105,266.6,8.5,[255,255,255],'bold',{align:'center'});footer(1);

  // PAGE 2 — selected major + visual profile + careers
  pdf.addPage();
  pdf.setFillColor(...navy);pdf.rect(0,0,W,50,'F');compassMark(21,18,8);text('CompassU',35,17,19,[255,255,255],'bold');text('From insight to a path you can explore',35,28,9.2,[210,222,255],'bold');
  pdf.addImage(actionImage,'PNG',130,7,66,36,undefined,'FAST');pdf.setFillColor(...gold);pdf.rect(14,54,182,2,'F');

  text(selected?`Why ${selected.major_name} Points North`:'Why Your Top Direction Points North',14,70,14.2,ink,'bold');
  wrapped('Your selected path reflects the traits most important to this field. The profile below shows where your assessment signals align most strongly.',14,79,182,8.7,muted,'normal',4.3);

  text('Your Profile at a Glance',14,98,12.5,ink,'bold');
  let ty=108;
  if(traitRows.length){traitRows.forEach((t,i)=>{const score=Math.max(0,Math.min(100,Number(t.user_score)||0));card(14,ty,182,17,i%2===0?[248,250,255]:[252,250,255]);text(t.trait_name,20,ty+6.5,8.1,ink,'bold');text(`${score.toFixed(0)}%`,190,ty+6.5,8.1,blue,'bold',{align:'right'});pdf.setFillColor(228,234,246);pdf.roundedRect(20,ty+10,165,3,1.5,1.5,'F');pdf.setFillColor(...(i%2===0?blue:purple));pdf.roundedRect(20,ty+10,165*(score/100),3,1.5,1.5,'F');ty+=19;});}else{card(14,ty,182,24,pale);wrapped('Detailed trait alignment will appear here when explanation data are available for this result.',20,ty+8,168,8.2,muted);ty+=30;}

  const careerStart=Math.max(ty+6,196);
  text('Career Waypoints',14,careerStart,13.5,ink,'bold');text('Occupations connected to your selected major',14,careerStart+7,7.7,muted);
  let cy=careerStart+14;
  const page2Careers=careerRows.slice(0,3);
  if(page2Careers.length){page2Careers.forEach((o,i)=>{card(14,cy,182,18.5,i===0?[238,244,255]:[250,251,253]);pdf.setFillColor(...(i===0?purple:blue));pdf.circle(23,cy+9.2,4,'F');text(String(i+1),23,cy+10.8,7,[255,255,255],'bold',{align:'center'});const n=pdf.splitTextToSize(o.name,120);text(n[0],31,cy+6.3,8.3,ink,'bold');const details=[`${money(o.median_salary)} median pay`,o.outlook_percent!=null?`${o.outlook_percent}% projected growth`:null].filter(Boolean).join('  •  ');text(details,31,cy+12.4,6.7,muted);cy+=20.5;});}else{card(14,cy,182,25,pale);wrapped('No direct federal CIP-to-occupation crosswalk is available for this selected major, so CompassU does not fabricate career links.',20,cy+8,168,8.2,muted);}
  footer(2);

  // PAGE 3 — career continuation + action plan
  pdf.addPage();
  pdf.setFillColor(...navy);pdf.rect(0,0,W,44,'F');compassMark(21,18,8);text('CompassU',35,17,19,[255,255,255],'bold');text('Turn direction into action',35,28,9.2,[210,222,255],'bold');pdf.setFillColor(...gold);pdf.rect(14,48,182,2,'F');

  text('Career Possibilities to Explore',14,65,14.5,ink,'bold');wrapped('Use these occupations as starting points for job shadowing, informational interviews, internship searches, and conversations with advisors.',14,74,182,8.7,muted,'normal',4.3);
  let py=91;
  const remaining=careerRows.slice(3,8);
  if(remaining.length){remaining.forEach((o,i)=>{card(14,py,182,19,i%2===0?[248,250,255]:[252,250,255]);pdf.setFillColor(...(i%2===0?blue:purple));pdf.circle(23,py+9.5,4,'F');text(String(i+4),23,py+11.1,7,[255,255,255],'bold',{align:'center'});const n=pdf.splitTextToSize(o.name,117);text(n[0],31,py+6.2,8.2,ink,'bold');const details=[`${money(o.median_salary)} median pay`,o.outlook_percent!=null?`${o.outlook_percent}% growth`:null,o.annual_openings!=null?`${Number(o.annual_openings).toLocaleString()} annual openings`:null].filter(Boolean).join('  •  ');text(details,31,py+12.8,6.6,muted);py+=21;});}else{card(14,py,182,24,pale);wrapped('Your roadmap currently includes the career waypoints shown on the previous page.',20,py+9,168,8.2,muted);py+=30;}

  const actionY=Math.max(py+7,190);
  text('Chart Your Next Move',14,actionY,14.5,ink,'bold');
  pdf.addImage(actionImage,'PNG',120,actionY+7,76,45,undefined,'FAST');
  const steps=[['1','Explore','Review your strongest major matches and save the paths that feel most compelling.',blue],['2','Compare','Compare salary, growth, openings, education, and the kind of work each path involves.',purple],['3','Connect','Talk with a counselor, advisor, faculty member, or professional working in the field.',[177,122,16]],['4','Choose','Use College Destinations to identify programs that can turn your direction into a destination.',green]];
  let sy=actionY+12;
  steps.forEach(([num,label,body,color])=>{pdf.setFillColor(...color);pdf.circle(20,sy+2.2,3.6,'F');text(num,20,sy+3.7,6.6,[255,255,255],'bold',{align:'center'});text(label,28,sy+1.4,8.2,ink,'bold');wrapped(body,28,sy+6.1,83,7.1,muted,'normal',3.5);sy+=15;});
  pdf.setFillColor(...navy);pdf.roundedRect(14,257,182,13,4,4,'F');text('Keep exploring. Keep growing. Keep moving forward.',105,265,8.3,[255,255,255],'bold',{align:'center'});footer(3);

  pdf.save('CompassU-Personalized-Career-Pathway-Results.pdf');
}
