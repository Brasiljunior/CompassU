export async function generateCompassUPdf({matches=[],selectedMajor=null,traits=[],careers=[],session=null}){
  if(!matches.length)return;
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  const W=210,H=297;
  const navy=[15,29,64],blue=[47,111,237],purple=[111,92,255],gold=[244,183,64],ink=[23,32,51],muted=[88,101,122],pale=[242,246,255],green=[25,118,75];
  const firstName=session?.user?.user_metadata?.first_name||'Student';
  const top=matches.slice(0,6);
  const careerRows=careers.slice(0,5).map(r=>r.occupations||{}).filter(o=>o.name);
  const traitRows=traits.slice(0,6);
  const money=value=>value==null?'Unavailable':`$${Number(value).toLocaleString()}`;
  const text=(value,x,y,size=10,color=ink,style='normal',options={})=>{pdf.setFont('helvetica',style);pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(String(value??''),x,y,options)};
  const wrapped=(value,x,y,width,size=9,color=muted,style='normal',line=4.5)=>{pdf.setFont('helvetica',style);pdf.setFontSize(size);pdf.setTextColor(...color);const lines=pdf.splitTextToSize(String(value??''),width);pdf.text(lines,x,y);return y+lines.length*line};
  const footer=page=>{pdf.setDrawColor(225,230,240);pdf.line(14,281,196,281);text('CompassU  •  Discover. Plan. Succeed.  •  getcompassu.com',14,287,7.5,muted,'bold');text(`Personalized Career Pathway Results  •  Page ${page}`,196,287,7.5,muted,'normal',{align:'right'});text('Educational decision-support tool. Career and college data are informed by federal CIP, BLS, and IPEDS sources.',14,292,6.7,[112,122,139]);};
  const compass=(cx,cy,r)=>{pdf.setFillColor(...blue);pdf.circle(cx,cy,r,'F');pdf.setDrawColor(255,255,255);pdf.setLineWidth(.7);pdf.circle(cx,cy,r-2,'S');pdf.setFillColor(255,255,255);pdf.triangle(cx,cy-r+3,cx-2.2,cy+1,cx+2.2,cy+1,'F');pdf.setFillColor(...gold);pdf.triangle(cx,cy+r-3,cx-2.2,cy-1,cx+2.2,cy-1,'F');text('N',cx,cy-r-1.3,5.5,[255,255,255],'bold',{align:'center'});};
  const landscape=(x,y,w,h)=>{pdf.setFillColor(227,237,255);pdf.roundedRect(x,y,w,h,4,4,'F');pdf.setFillColor(255,224,147);pdf.circle(x+w*.76,y+h*.3,h*.13,'F');pdf.setFillColor(170,191,230);pdf.triangle(x,y+h*.78,x+w*.26,y+h*.30,x+w*.48,y+h*.78,'F');pdf.setFillColor(104,139,194);pdf.triangle(x+w*.24,y+h*.78,x+w*.55,y+h*.18,x+w*.83,y+h*.78,'F');pdf.setFillColor(71,111,170);pdf.triangle(x+w*.58,y+h*.78,x+w*.80,y+h*.37,x+w,y+h*.78,'F');pdf.setFillColor(236,242,252);pdf.rect(x,y+h*.76,w,h*.24,'F');pdf.setDrawColor(...gold);pdf.setLineWidth(2.6);pdf.lines([[w*.08,-h*.08],[w*.10,-h*.10],[w*.10,-h*.08],[w*.11,-h*.06]],x+w*.42,y+h*.98,[1,1],'S',false);compass(x+w*.15,y+h*.22,h*.14);};
  const card=(x,y,w,h,fill=[255,255,255])=>{pdf.setFillColor(...fill);pdf.setDrawColor(225,231,242);pdf.roundedRect(x,y,w,h,3,3,'FD');};

  // PAGE 1 — visual cover + strongest directions
  pdf.setFillColor(...navy);pdf.rect(0,0,W,72,'F');
  pdf.setFillColor(...blue);pdf.rect(0,0,7,72,'F');
  compass(23,20,9);
  text('CompassU',39,18,23,[255,255,255],'bold');
  text('DISCOVER  •  PLAN  •  SUCCEED',39,27,7.5,[199,214,255],'bold');
  text('YOUR PERSONALIZED',15,46,8,[205,216,255],'bold');
  text('Career Pathway Results',15,58,21,[255,255,255],'bold');
  text(`Prepared for ${firstName}`,15,66,9,[226,233,255]);
  landscape(127,15,68,47);
  pdf.setFillColor(...gold);pdf.rect(15,75,180,2.2,'F');

  text('Your direction is coming into focus.',15,91,16,ink,'bold');
  wrapped('CompassU turns your 80-question assessment into a practical roadmap. These results are a compass, not a command—use them to explore the majors, careers, and college destinations that fit you best.',15,100,180,9.3,muted,'normal',4.7);

  // Snapshot strip
  const best=top[0];
  card(15,120,55,32,pale);card(77.5,120,55,32,[247,244,255]);card(140,120,55,32,[255,248,232]);
  text('TOP ALIGNMENT',20,129,7,blue,'bold');text(best?`${Number(best.match_score).toFixed(0)}%`:'—',20,141,18,ink,'bold');text('strongest major match',20,147,7.4,muted);
  text('DIRECTIONS',82.5,129,7,purple,'bold');text(String(matches.length),82.5,141,18,ink,'bold');text('ranked major matches',82.5,147,7.4,muted);
  text('ASSESSMENT',145,129,7,[177,122,16],'bold');text('80',145,141,18,ink,'bold');text('insights reviewed',145,147,7.4,muted);

  text('Your Strongest Directions',15,168,15,ink,'bold');
  text('Major matches ranked by alignment with your multidimensional profile',15,175,8,muted);
  let y=185;
  top.forEach((m,i)=>{const isTop=i===0;card(15,y,180,13,isTop?[235,242,255]:[250,251,253]);pdf.setFillColor(isTop?...blue:[210,220,239]);pdf.circle(24,y+6.5,4.3,'F');text(String(m.rank),24,y+8,8,[255,255,255],'bold',{align:'center'});text(m.major_name,32,y+6.1,9.2,ink,'bold');text(isTop?'Your strongest current direction':'Explore this possible path',32,y+10.3,6.8,muted);text(`${Number(m.match_score).toFixed(0)}%`,189,y+8.2,10,isTop?green:blue,'bold',{align:'right'});y+=15;});

  pdf.setFillColor(...navy);pdf.roundedRect(15,267,180,10,3,3,'F');text('YOUR FUTURE. YOUR DIRECTION. YOUR NEXT MOVE.',105,273.5,8,[255,255,255],'bold',{align:'center'});
  footer(1);

  // PAGE 2 — profile, careers, next steps
  pdf.addPage();
  pdf.setFillColor(...navy);pdf.rect(0,0,W,42,'F');compass(22,19,8);text('CompassU',36,17,19,[255,255,255],'bold');text('Your Roadmap — From Insight to Action',36,27,10,[210,222,255],'bold');
  landscape(139,8,56,27);
  pdf.setFillColor(...gold);pdf.rect(15,45,180,2,'F');

  const selected=selectedMajor||top[0];
  text(selected?`Why ${selected.major_name} Points North`:'Why Your Top Direction Points North',15,60,14,ink,'bold');
  wrapped('Your selected path reflects the traits that matter most to this field. Use these alignment signals as conversation starters with counselors, advisors, faculty, and professionals.',15,68,180,8.7,muted,'normal',4.4);

  let ty=85;
  if(traitRows.length){traitRows.forEach(t=>{const score=Math.max(0,Math.min(100,Number(t.user_score)||0));text(t.trait_name,15,ty,8.2,ink,'bold');text(`${score.toFixed(0)}% alignment`,195,ty,7.8,blue,'bold',{align:'right'});pdf.setFillColor(231,236,245);pdf.roundedRect(15,ty+3,180,3.2,1.6,1.6,'F');pdf.setFillColor(...blue);pdf.roundedRect(15,ty+3,180*(score/100),3.2,1.6,1.6,'F');ty+=13;});}else{wrapped('Detailed trait alignment will appear here when explanation data are available for this result.',15,ty,180,8.5,muted);ty+=16;}

  const careerY=Math.max(ty+4,157);
  text('Career Waypoints',15,careerY,14,ink,'bold');text('See where your selected major can lead',15,careerY+7,8,muted);
  let cy=careerY+15;
  if(careerRows.length){careerRows.forEach((o,i)=>{if(cy>245)return;card(15,cy,180,17,i===0?[239,245,255]:[250,251,253]);pdf.setFillColor(...(i===0?purple:blue));pdf.circle(23,cy+8.5,3.8,'F');text(String(i+1),23,cy+10.2,7,[255,255,255],'bold',{align:'center'});text(o.name,31,cy+7,8.7,ink,'bold');const details=[`${money(o.median_salary)} median pay`,o.outlook_percent!=null?`${o.outlook_percent}% projected growth`:null,o.annual_openings!=null?`${Number(o.annual_openings).toLocaleString()} annual openings`:null].filter(Boolean).join('  •  ');text(details,31,cy+12.4,6.9,muted);cy+=19;});}else{wrapped('No direct federal CIP-to-occupation crosswalk is available for this selected major, so CompassU does not fabricate career links.',15,cy,180,8.2,muted);cy+=18;}

  if(cy<252){text('Chart Your Next Move',15,cy+5,13,ink,'bold');const ny=cy+11;card(15,ny,180,27,[247,249,253]);text('1',23,ny+9,10,blue,'bold');text('Explore your strongest major matches.',31,ny+9,8.1,ink,'bold');text('2',23,ny+16,10,purple,'bold');text('Compare career pay, growth, openings, and education.',31,ny+16,8.1,ink,'bold');text('3',23,ny+23,10,[177,122,16],'bold');text('Use College Destinations to turn direction into a destination.',31,ny+23,8.1,ink,'bold');}
  footer(2);
  pdf.save('CompassU-Personalized-Career-Pathway-Results.pdf');
}
