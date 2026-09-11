export const COMPASSU_PDF_COLORS={navy:[7,53,91],teal:[42,165,180],gold:[215,162,31]};

// Vector rendering of the approved CompassU compass rose for sharp PDF exports.
export function drawCompassMark(doc,x,y,r,{onDark=false}={}){
 const{navy,teal,gold}=COMPASSU_PDF_COLORS,primary=onDark?[255,255,255]:navy;
 doc.setDrawColor(...primary);doc.setLineWidth(Math.max(.7,r*.1));doc.circle(x,y,r*.74,'S');
 const point=(angle,length,width,color)=>{const a=angle*Math.PI/180,tip=[x+Math.sin(a)*length,y-Math.cos(a)*length],left=[x+Math.sin(a-Math.PI/2)*width,y-Math.cos(a-Math.PI/2)*width],right=[x+Math.sin(a+Math.PI/2)*width,y-Math.cos(a+Math.PI/2)*width];doc.setFillColor(...color);doc.triangle(tip[0],tip[1],left[0],left[1],right[0],right[1],'F')};
 [0,90,180,270].forEach(a=>point(a,r,r*.2,primary));[45,135,225,315].forEach(a=>point(a,r*.72,r*.14,teal));
 doc.setFillColor(...gold);doc.circle(x,y,r*.2,'F');doc.setFillColor(255,255,255);doc.circle(x,y,r*.065,'F');
}

export function drawCompassUBrand(doc,{x,y,size=24,onDark=false,tagline=false}={}){
 const{navy,teal}=COMPASSU_PDF_COLORS;drawCompassMark(doc,x+size/2,y+size/2,size/2,{onDark});const color=onDark?[255,255,255]:navy;
 doc.setFont('helvetica','bold');doc.setFontSize(size*.72);doc.setTextColor(...color);doc.text('Compass',x+size*1.18,y+size*.69);const w=doc.getTextWidth('Compass');doc.setTextColor(...(onDark?[83,209,220]:teal));doc.text('U',x+size*1.18+w,y+size*.69);
 if(tagline){doc.setFontSize(size*.16);doc.setTextColor(...(onDark?[205,225,235]:navy));doc.text('NAVIGATE TODAY. BRIGHTER TOMORROWS.',x+size*1.2,y+size*.96)}
}
