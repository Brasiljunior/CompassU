export async function generateCompassUPdf({matches=[],selectedMajor=null,traits=[],careers=[],session=null}){
  if(!matches.length)return;
  const {jsPDF}=await import('jspdf');
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  const W=210,H=297;
  const navy=[15,29,64],blue=[47,111,237],purple=[111,92,255],gold=[244,183,64],ink=[23,32,51],muted=[88,101,122],green=[25,118,75],line=[224,231,242];
  const firstName=session?.user?.user_metadata?.first_name||'Student';
  const top=matches.slice(0,5);
  const selected=selectedMajor||top[0];
  const traitRows=traits.slice(0,6);
  const careerRows=careers.map(r=>r.occupations||{}).filter(o=>o.name).slice(0,6);
  const money=value=>value==null?'Unavailable':`$${Number(value).toLocaleString()}`;

  const setFont=(size=10,color=ink,style='normal')=>{pdf.setFont('helvetica',style);pdf.setFontSize(size);pdf.setTextColor(...color)};
  const text=(value,x,y,size=10,color=ink,style='normal',options={})=>{setFont(size,color,style);pdf.text(String(value??''),x,y,options)};
  const wrap=(value,x,y,width,size=9,color=muted,style='normal',lineHeight=4.4,maxLines=null)=>{setFont(size,color,style);let lines=pdf.splitTextToSize(String(value??''),width);if(maxLines&&lines.length>maxLines){lines=lines.slice(0,maxLines);const last=lines[maxLines-1];lines[maxLines-1]=last.length>3?`${last.slice(0,-3)}...`:last}pdf.text(lines,x,y);return y+lines.length*lineHeight};
  const card=(x,y,w,h,fill=[255,255,255],stroke=line,r=4)=>{pdf.setFillColor(...fill);pdf.setDrawColor(...stroke);pdf.setLineWidth(.45);pdf.roundedRect(x,y,w,h,r,r,'FD')};
  const footer=page=>{pdf.setDrawColor(...line);pdf.line(14,280,196,280);text('CompassU  |  Discover. Plan. Succeed.  |  getcompassu.com',14,286,7,muted,'bold');text(`Personalized Career Pathway Results  |  Page ${page}`,196,286,7,muted,'normal',{align:'right'});text('Educational decision-support tool. Career and college data are informed by federal CIP, BLS, and IPEDS sources.',14,291,6.2,[112,122,139])};
  const compassMark=(cx,cy,r)=>{pdf.setFillColor(...blue);pdf.circle(cx,cy,r,'F');pdf.setDrawColor(255,255,255);pdf.setLineWidth(.7);pdf.circle(cx,cy,r-2,'S');pdf.setFillColor(255,255,255);pdf.triangle(cx,cy-r+3,cx-2.2,cy+1,cx+2.2,cy+1,'F');pdf.setFillColor(...gold);pdf.triangle(cx,cy+r-3,cx-2.2,cy-1,cx+2.2,cy-1,'F');text('N',cx,cy-r-1.2,5,[255,255,255],'bold',{align:'center'})};
  const header=(title,subtitle,page)=>{pdf.setFillColor(...navy);pdf.rect(0,0,W,43,'F');pdf.setFillColor(...blue);pdf.rect(0,0,5,43,'F');compassMark(20,18,8);text('CompassU',34,16.5,19,[255,255,255],'bold');text(title,34,27,9,[208,221,255],'bold');text(subtitle,14,56,15,ink,'bold');pdf.setFillColor(...gold);pdf.rect(14,62,182,1.8,'F');footer(page)};

  const makeHeroIllustration=(mode='hero')=>{
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const c=canvas.getContext('2d');
    const sky=c.createLinearGradient(0,0,0,1000);sky.addColorStop(0,'#dce8ff');sky.addColorStop(.52,'#f8f9ff');sky.addColorStop(1,'#fff3cf');c.fillStyle=sky;c.fillRect(0,0,1600,1000);
    const sun=c.createRadialGradient(1220,190,20,1220,190,150);sun.addColorStop(0,'#fff5bd');sun.addColorStop(.65,'#ffd978');sun.addColorStop(1,'rgba(255,217,120,0)');c.fillStyle=sun;c.beginPath();c.arc(1220,190,150,0,Math.PI*2);c.fill();c.fillStyle='#ffd36b';c.beginPath();c.arc(1220,190,88,0,Math.PI*2);c.fill();
    c.fillStyle='#c8d6f1';c.beginPath();c.moveTo(-80,720);c.lineTo(330,270);c.lineTo(700,720);c.closePath();c.fill();
    c.fillStyle='#88a5d4';c.beginPath();c.moveTo(230,720);c.lineTo(760,145);c.lineTo(1210,720);c.closePath();c.fill();
    c.fillStyle='#4f78b5';c.beginPath();c.moveTo(770,720);c.lineTo(1160,340);c.lineTo(1650,720);c.closePath();c.fill();
    c.fillStyle='#e9eff9';c.fillRect(0,720,1600,280);
    c.fillStyle='#d7e1f3';c.beginPath();c.ellipse(820,855,650,125,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#f4b740';c.lineWidth=54;c.lineCap='round';c.beginPath();c.moveTo(690,1000);c.bezierCurveTo(710,900,810,845,900,780);c.bezierCurveTo(1010,700,1070,600,1275,550);c.stroke();
    c.strokeStyle='#fff4c8';c.lineWidth=13;c.beginPath();c.moveTo(690,1000);c.bezierCurveTo(710,900,810,845,900,780);c.bezierCurveTo(1010,700,1070,600,1275,550);c.stroke();
    const hx=650,hy=720;c.strokeStyle='#102044';c.lineWidth=26;c.lineCap='round';c.beginPath();c.moveTo(hx,hy+96);c.lineTo(hx-45,hy+190);c.moveTo(hx+20,hy+96);c.lineTo(hx+70,hy+190);c.moveTo(hx-10,hy+30);c.lineTo(hx-70,hy+105);c.moveTo(hx+15,hy+30);c.lineTo(hx+75,hy+95);c.stroke();c.fillStyle='#102044';c.beginPath();c.arc(hx,hy,34,0,Math.PI*2);c.fill();c.fillRect(hx-25,hy+28,50,85);c.fillStyle='#6f5cff';c.beginPath();c.arc(hx-35,hy+55,35,0,Math.PI*2);c.fill();c.fillStyle='#2f6fed';c.fillRect(hx-72,hy+36,35,65);
    c.fillStyle='#ffffff';c.strokeStyle='#d8e0f0';c.lineWidth=7;c.beginPath();c.roundRect(80,95,280,255,36);c.fill();c.stroke();c.fillStyle='#2f6fed';c.beginPath();c.arc(220,220,86,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=10;c.beginPath();c.arc(220,220,62,0,Math.PI*2);c.stroke();c.fillStyle='#fff';c.beginPath();c.moveTo(220,143);c.lineTo(190,228);c.lineTo(220,210);c.lineTo(250,228);c.closePath();c.fill();c.fillStyle='#f4b740';c.beginPath();c.moveTo(220,297);c.lineTo(190,212);c.lineTo(220,230);c.lineTo(250,212);c.closePath();c.fill();c.fillStyle='#0f1d40';c.font='700 28px Arial';c.textAlign='center';c.fillText('N',220,120);
    if(mode==='action'){
      c.fillStyle='rgba(15,29,64,.92)';c.beginPath();c.roundRect(1000,700,470,200,34);c.fill();c.fillStyle='#ffffff';c.font='700 48px Arial';c.textAlign='left';c.fillText('YOUR NEXT MOVE',1055,770);c.font='30px Arial';c.fillStyle='#dfe8ff';c.fillText('Explore  •  Compare',1055,825);c.fillText('Connect  •  Choose',1055,870);
    }
    return canvas.toDataURL('image/jpeg',.92);
  };

  const heroImage=makeHeroIllustration('hero');
  const actionImage=makeHeroIllustration('action');

  // PAGE 1 - illustrated cover
  pdf.addImage(heroImage,'JPEG',0,0,W,132,undefined,'FAST');
  pdf.setFillColor(...navy);pdf.rect(0,0,W,34,'F');pdf.setFillColor(...blue);pdf.rect(0,0,5,34,'F');compassMark(19,17,8);text('CompassU',33,16.5,20,[255,255,255],'bold');text('DISCOVER  |  PLAN  |  SUCCEED',33,26,7,[205,219,255],'bold');
  pdf.setFillColor(15,29,64,.95);pdf.roundedRect(14,86,112,39,6,6,'F');text('PERSONALIZED CAREER PATHWAY RESULTS',21,97,7.2,[202,218,255],'bold');text('Your Future Has',21,108,18,[255,255,255],'bold');text('a Direction.',21,120,23,[255,255,255],'bold');
  card(14,143,182,43,[255,255,255]);text(`Prepared for ${firstName}`,22,156,10,blue,'bold');text('Your direction is coming into focus.',22,168,16,ink,'bold');wrap('CompassU turns your 80-question assessment into a personalized roadmap for exploring majors, careers, and college destinations that fit who you are.',22,177,165,9.3,muted,'normal',4.6,3);
  const best=top[0];card(14,198,54,32,[239,244,255]);card(78,198,54,32,[247,244,255]);card(142,198,54,32,[255,249,234]);text('TOP ALIGNMENT',20,207,6.8,blue,'bold');text(best?`${Number(best.match_score).toFixed(0)}%`:'-',20,219,18,ink,'bold');text('strongest match',20,226,6.8,muted);text('DIRECTIONS',84,207,6.8,purple,'bold');text(String(matches.length),84,219,18,ink,'bold');text('ranked majors',84,226,6.8,muted);text('ASSESSMENT',148,207,6.8,[177,122,16],'bold');text('80',148,219,18,ink,'bold');text('insights reviewed',148,226,6.8,muted);
  pdf.setFillColor(...navy);pdf.roundedRect(14,243,182,25,5,5,'F');text('A compass, not a command.',22,254,12,[255,255,255],'bold');text('Use these results to explore possibilities, ask better questions, and choose your next step with confidence.',22,262,8,[219,229,255]);footer(1);

  // PAGE 2 - strongest directions
  pdf.addPage();header('Your strongest directions','Top major matches at a glance',2);
  text('Your Strongest Directions',14,80,16,ink,'bold');wrap('These are the five majors with the strongest current alignment to your assessment profile. Treat them as high-priority paths to explore - not fixed outcomes.',14,90,182,9,muted,'normal',4.4,3);
  let y=111;
  top.forEach((m,i)=>{const isTop=i===0;card(14,y,182,25,isTop?[235,242,255]:[250,251,253]);pdf.setFillColor(...(isTop?blue:[204,216,238]));pdf.circle(27,y+12.5,7,'F');text(String(m.rank),27,y+15,10,[255,255,255],'bold',{align:'center'});wrap(m.major_name,40,y+8,115,10,ink,'bold',4.4,2);text(`${Number(m.match_score).toFixed(0)}%`,187,y+12,12,isTop?green:blue,'bold',{align:'right'});text(isTop?'Your strongest current direction':'A strong path worth exploring',40,y+20,7.2,muted);y+=29;});
  card(14,259,182,13,[15,29,64],[15,29,64],4);text('NEXT: Open each major in CompassU to compare careers, colleges, and fit.',105,267,8,[255,255,255],'bold',{align:'center'});

  // PAGE 3 - profile + career waypoints
  pdf.addPage();header('From insight to possible careers','Profile alignment and career waypoints',3);
  text(selected?`Why ${selected.major_name} Points North`:'Why Your Top Direction Points North',14,80,15,ink,'bold');wrap('Your selected path reflects the traits most important to this field. The alignment bars below show where your assessment signals are strongest.',14,90,182,8.8,muted,'normal',4.3,3);
  text('Your Profile at a Glance',14,111,12.5,ink,'bold');
  let ty=121;
  if(traitRows.length){traitRows.forEach((t,i)=>{const score=Math.max(0,Math.min(100,Number(t.user_score)||0));text(t.trait_name,14,ty,8.2,ink,'bold');text(`${score.toFixed(0)}%`,196,ty,8.2,i%2===0?blue:purple,'bold',{align:'right'});pdf.setFillColor(232,237,246);pdf.roundedRect(14,ty+4,182,4,2,2,'F');pdf.setFillColor(...(i%2===0?blue:purple));pdf.roundedRect(14,ty+4,182*(score/100),4,2,2,'F');ty+=15;});}else{card(14,ty,182,23,[248,250,255]);wrap('Detailed trait alignment will appear here when explanation data are available for this result.',20,ty+9,168,8.2,muted);ty+=31;}
  const cyStart=Math.max(ty+7,205);text('Career Waypoints',14,cyStart,13.5,ink,'bold');text('Occupations connected to your selected major',14,cyStart+7,7.5,muted);
  let cy=cyStart+14;careerRows.slice(0,3).forEach((o,i)=>{card(14,cy,182,18.5,i===0?[238,244,255]:[250,251,253]);pdf.setFillColor(...(i===0?purple:blue));pdf.circle(23,cy+9.2,4,'F');text(String(i+1),23,cy+10.8,7,[255,255,255],'bold',{align:'center'});wrap(o.name,31,cy+6.2,114,8.2,ink,'bold',3.8,1);const details=[`${money(o.median_salary)} median pay`,o.outlook_percent!=null?`${o.outlook_percent}% projected growth`:null].filter(Boolean).join('  |  ');text(details,31,cy+12.7,6.6,muted);cy+=20.5;});

  // PAGE 4 - action plan + full visual
  pdf.addPage();pdf.addImage(actionImage,'JPEG',0,0,W,112,undefined,'FAST');pdf.setFillColor(...navy);pdf.rect(0,0,W,33,'F');pdf.setFillColor(...blue);pdf.rect(0,0,5,33,'F');compassMark(19,16,8);text('CompassU',33,16,20,[255,255,255],'bold');text('TURN DIRECTION INTO ACTION',33,26,7,[205,219,255],'bold');
  card(14,122,182,38,[255,255,255]);text('Career Possibilities to Explore',22,136,15,ink,'bold');wrap('Use these occupations as starting points for job shadowing, informational interviews, internship searches, and conversations with advisors.',22,147,164,8.6,muted,'normal',4.2,3);
  let py=171;careerRows.slice(3,6).forEach((o,i)=>{card(14,py,182,19,[248,250,255]);pdf.setFillColor(...(i%2===0?blue:purple));pdf.circle(23,py+9.5,4,'F');text(String(i+4),23,py+11,7,[255,255,255],'bold',{align:'center'});wrap(o.name,31,py+6.2,115,8.2,ink,'bold',3.8,1);const details=[`${money(o.median_salary)} median pay`,o.outlook_percent!=null?`${o.outlook_percent}% growth`:null,o.annual_openings!=null?`${Number(o.annual_openings).toLocaleString()} annual openings`:null].filter(Boolean).join('  |  ');text(details,31,py+12.8,6.4,muted);py+=21;});
  const nextY=Math.max(py+4,238);text('Chart Your Next Move',14,nextY,13.5,ink,'bold');
  const steps=[['1','Explore','Review your strongest major matches.'],['2','Compare','Compare salary, growth, openings, and education.'],['3','Connect','Talk with a counselor, advisor, faculty member, or professional.'],['4','Choose','Use College Destinations to identify programs and schools.']];
  let sx=14;steps.forEach((s,i)=>{const fills=[[239,244,255],[247,244,255],[255,249,234],[240,249,246]];card(sx,nextY+8,42.5,28,fills[i]);text(s[0],sx+5,nextY+17,10,i===0?blue:i===1?purple:i===2?[177,122,16]:green,'bold');text(s[1],sx+13,nextY+17,8.4,ink,'bold');wrap(s[2],sx+5,nextY+23,32.5,6.5,muted,'normal',3.1,3);sx+=46.5;});footer(4);

  pdf.save('CompassU-Personalized-Career-Pathway-Results.pdf');
}
