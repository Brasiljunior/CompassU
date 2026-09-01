export async function generateCompassUPdf({matches=[],selectedMajor=null,traits=[],careers=[],session=null}){
 if(!matches.length)return;
 const{jsPDF}=await import('jspdf');
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const W=297,H=210,C={navy:[7,28,70],blue:[35,112,235],purple:[101,65,219],green:[35,151,72],gold:[243,162,28],ink:[18,38,83],muted:[78,95,126],line:[220,227,239],pale:[247,249,253],lav:[246,244,255]};
 const first=session?.user?.user_metadata?.first_name||'Student',top=matches.slice(0,5),sel=selectedMajor||top[0],trs=traits.slice(0,5),cars=careers.map(r=>r.occupations||{}).filter(o=>o.name).slice(0,6);
 const money=v=>v==null?'Unavailable':`$${Number(v).toLocaleString()}`,pct=v=>`${Number(v||0).toFixed(0)}%`;
 const sf=(s=10,c=C.ink,st='normal')=>{pdf.setFont('helvetica',st);pdf.setFontSize(s);pdf.setTextColor(...c)};
 const tx=(v,x,y,s=10,c=C.ink,st='normal',o={})=>{sf(s,c,st);pdf.text(String(v??''),x,y,o)};
 const wr=(v,x,y,w,s=9,c=C.muted,st='normal',lh=4.2,max=99)=>{sf(s,c,st);let a=pdf.splitTextToSize(String(v??''),w);if(a.length>max)a=a.slice(0,max);pdf.text(a,x,y);return a.length*lh};
 const cd=(x,y,w,h,f=[255,255,255],r=4)=>{pdf.setFillColor(...f);pdf.setDrawColor(...C.line);pdf.setLineWidth(.4);pdf.roundedRect(x,y,w,h,r,r,'FD')};
 const ln=(a,b,c,d,col=C.line,w=.4)=>{pdf.setDrawColor(...col);pdf.setLineWidth(w);pdf.line(a,b,c,d)};
 const ci=(x,y,r,f,l)=>{pdf.setFillColor(...f);pdf.circle(x,y,r,'F');tx(l,x,y+2.3,r*1.15,[255,255,255],'bold',{align:'center'})};
 const compass=(x,y,r)=>{pdf.setFillColor(...C.blue);pdf.circle(x,y,r,'F');pdf.setDrawColor(255,255,255);pdf.setLineWidth(.6);pdf.circle(x,y,r-2,'S');pdf.setFillColor(255,255,255);pdf.triangle(x,y-r+2,x-2,y+1,x+2,y+1,'F');pdf.setFillColor(...C.gold);pdf.triangle(x,y+r-2,x-2,y-1,x+2,y-1,'F')};
 const foot=p=>{pdf.setFillColor(...C.navy);pdf.rect(0,H-9,W,9,'F');tx('CompassU  |  Discover. Plan. Succeed.  |  getcompassu.com',9,H-3.6,6.6,[255,255,255],'bold');tx(`Page ${p}`,W-9,H-3.6,6.6,[255,255,255],'bold',{align:'right'})};
 async function img(url){try{const r=await fetch(url,{mode:'cors'});if(!r.ok)throw 0;const b=await r.blob();return await new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=rej;f.readAsDataURL(b)})}catch{return null}}
 const [hero,action]=await Promise.all([img('https://images.unsplash.com/photo-1780402838881-51355887536f?auto=format&fit=crop&fm=jpg&q=82&w=1800'),img('https://images.unsplash.com/photo-1660296146402-ce70cb473615?auto=format&fit=crop&fm=jpg&q=82&w=1800')]);
 if(hero)pdf.addImage(hero,'JPEG',115,24,182,113,undefined,'FAST');else{pdf.setFillColor(225,235,252);pdf.rect(115,24,182,113,'F')}
 pdf.setFillColor(...C.navy);pdf.rect(0,0,W,24,'F');compass(16,12,8);tx('CompassU',29,13.5,21,[255,255,255],'bold');tx('DISCOVER. PLAN. SUCCEED.',29,20,6.5,[216,227,251],'bold');tx('Your Future.  Your Direction.  Our Guidance.',286,15,8,[255,255,255],'bold',{align:'right'});
 tx('YOUR PERSONALIZED',14,48,9,C.purple,'bold');tx('CAREER PATHWAY',14,64,23,C.navy,'bold');tx('Results',14,83,25,C.purple,'italic');
 wr('You have taken an important step toward your future. CompassU turns your 80-question assessment into a practical, personalized roadmap so you can explore, plan, and succeed.',14,97,91,9,C.ink,'normal',4.5,5);
 tx('PREPARED FOR',14,125,7.3,C.purple,'bold');tx(first,47,125,13,C.navy,'bold');
 cd(12,143,273,42,C.navy,5);tx('YOUR RESULTS SNAPSHOT',19,155,8,[255,255,255],'bold');
 const snaps=[['1','TOP MATCH',top[0]?pct(top[0].match_score):'-',C.purple],['5','TOP MAJORS',String(top.length),C.blue],['6','CAREER PATHS',String(cars.length),C.green],['80','ASSESSMENT','80',C.gold]];
 snaps.forEach((s,i)=>{const x=82+i*49;ln(x-11,150,x-11,178,[69,91,139],.5);ci(x,154,6,s[3],s[0]);tx(s[1],x,168,6.5,[222,231,255],'bold',{align:'center'});tx(s[2],x,178,12,[255,255,255],'bold',{align:'center'})});
 tx('YOUR FUTURE. YOUR DIRECTION. OUR GUIDANCE.',148.5,194,7,C.navy,'bold',{align:'center'});foot(1);
 pdf.addPage();tx('YOUR TOP MATCHES AT A GLANCE',12,17,14,C.navy,'bold');ln(111,14,281,14,C.purple,.7);compass(288,14,5.5);
 const cw=52.5,g=3.5,cy=27;
 top.forEach((m,i)=>{const x=12+i*(cw+g);cd(x,cy,cw,105,[255,255,255],4);if(hero)pdf.addImage(hero,'JPEG',x,cy,cw,31,undefined,'FAST');else{pdf.setFillColor(...[C.purple,C.blue,C.gold,[141,113,75],C.navy][i]);pdf.rect(x,cy,cw,31,'F')}ci(x+8,cy+8,6,[C.purple,C.blue,C.gold,[141,113,75],C.navy][i],String(i+1));wr(m.major_name,x+5,cy+41,cw-10,8.2,C.navy,'bold',3.9,3);tx(pct(m.match_score),x+5,cy+70,15,C.green,'bold');wr(i===0?'Your strongest current direction':'Explore this possible path',x+5,cy+82,cw-10,7,C.ink,'normal',3.7,3)});
 if(action)pdf.addImage(action,'JPEG',12,143,273,43,undefined,'FAST');else{pdf.setFillColor(239,243,251);pdf.rect(12,143,273,43,'F')}
 cd(92,151,113,25,[255,255,255],4);tx('Your future is shaped by the choices you explore.',148.5,160,10,C.navy,'italic',{align:'center'});tx('Use these matches as starting points for deeper exploration.',148.5,168,7.2,C.muted,'normal',{align:'center'});foot(2);
 pdf.addPage();compass(12,13,5);tx(sel?`WHY ${String(sel.major_name).toUpperCase()} POINTS NORTH`:'WHY YOUR TOP DIRECTION POINTS NORTH',22,17,13,C.navy,'bold');ln(177,14,284,14,C.purple,.7);wr('Your selected path reflects the traits that matter most to this field. The profile below shows where your assessment signals align most strongly.',22,25,255,8.4,C.ink,'normal',4.1,3);
 cd(12,42,108,123,C.lav,5);tx('YOUR PROFILE AT A GLANCE',20,56,11,C.purple,'bold');let y=70;
 if(trs.length)trs.forEach((t,i)=>{const sc=Math.max(0,Math.min(100,Number(t.user_score)||0));ci(28,y+2,7.3,i%2?C.blue:C.purple,String(i+1));wr(t.trait_name,41,y,47,7.8,C.navy,'bold',3.7,2);tx(pct(sc),109,y+5,10,C.navy,'bold',{align:'right'});pdf.setFillColor(230,234,244);pdf.roundedRect(41,y+11,68,3.4,1.7,1.7,'F');pdf.setFillColor(...(i%2?C.blue:C.purple));pdf.roundedRect(41,y+11,68*sc/100,3.4,1.7,1.7,'F');y+=20});
 if(action)pdf.addImage(action,'JPEG',12,169,108,30,undefined,'FAST');
 cd(128,42,157,157,[255,255,255],5);tx('CAREER WAYPOINTS',206.5,56,11,C.green,'bold',{align:'center'});tx('Occupations connected to your selected major',206.5,64,7.4,C.green,'normal',{align:'center'});
 y=74;cars.slice(0,4).forEach((o,i)=>{cd(137,y,139,25,i%2?[249,250,253]:[246,252,248],3);ci(146,y+7,4.5,C.green,String(i+1));wr(o.name,156,y+6,82,7.5,C.navy,'bold',3.4,2);tx(money(o.median_salary),156,y+18,8.7,C.green,'bold');tx('median pay',156,y+22.5,5.5,C.muted);if(o.outlook_percent!=null){tx(`${o.outlook_percent}%`,236,y+18,8.7,C.green,'bold',{align:'center'});tx('growth',236,y+22.5,5.5,C.muted,'normal',{align:'center'})}if(o.annual_openings!=null){tx(Number(o.annual_openings).toLocaleString(),267,y+18,8.7,C.green,'bold',{align:'center'});tx('openings',267,y+22.5,5.5,C.muted,'normal',{align:'center'})}y+=29});foot(3);
 pdf.addPage();tx('TURN DIRECTION INTO ACTION',12,17,14,C.navy,'bold');ln(106,14,170,14,C.purple,.7);
 cd(12,27,150,43,C.pale,4);tx('CAREER POSSIBILITIES TO EXPLORE',20,40,10.5,C.green,'bold');wr('Use these occupations as starting points for job shadowing, informational interviews, internship searches, and conversations with advisors.',20,50,132,7.5,C.ink,'normal',3.8,4);
 y=77;cars.slice(4,6).forEach((o,i)=>{cd(12,y,150,27,[255,255,255],3);ci(24,y+8,5,C.green,String(i+5));wr(o.name,35,y+7,76,7.4,C.navy,'bold',3.4,2);tx(money(o.median_salary),35,y+20,8.8,C.green,'bold');if(o.outlook_percent!=null)tx(`${o.outlook_percent}% growth`,108,y+20,7,C.green,'bold',{align:'center'});y+=31});
 if(action)pdf.addImage(action,'JPEG',12,143,150,49,undefined,'FAST');
 cd(170,27,115,165,C.pale,5);tx('CHART YOUR NEXT MOVE',180,42,11,C.purple,'bold');
 const steps=[['1','EXPLORE','Review your strongest major matches and save the paths that feel most compelling.',C.purple],['2','COMPARE','Compare salary, growth, openings, education, and the kind of work each path involves.',C.blue],['3','CONNECT','Talk with a counselor, advisor, faculty member, or professional working in the field.',C.green],['4','CHOOSE','Use College Destinations to identify programs that can turn your direction into a destination.',C.gold]];
 y=57;steps.forEach((s,i)=>{ci(183,y,5.4,s[3],s[0]);tx(s[1],196,y-1,8,s[3],'bold');wr(s[2],196,y+6,76,6.8,C.ink,'normal',3.5,4);if(i<3)ln(179,y+25,276,y+25,C.line,.35);y+=34});
 pdf.setFillColor(...C.navy);pdf.roundedRect(12,194,273,8,3,3,'F');tx('Keep exploring. Keep growing. Keep moving forward.',148.5,199.5,10,C.gold,'italic',{align:'center'});foot(4);
 pdf.save('CompassU-Personalized-Career-Pathway-Results.pdf');
}