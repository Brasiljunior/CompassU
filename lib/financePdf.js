import {jsPDF} from 'jspdf';
import {money,statementData} from './financeCore.mjs';
function document(title,company) {
 const pdf=new jsPDF();let y=24;
 pdf.setTextColor(28,48,87);pdf.setFontSize(24);pdf.text(String(company||'CompassU').slice(0,65),18,y);y+=13;
 pdf.setFontSize(16);pdf.text(title,18,y);y+=14;
 function line(text,bold=false){pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(10);const lines=pdf.splitTextToSize(String(text),174);for(const l of lines){if(y>275){pdf.addPage();y=20;}pdf.text(l,18,y);y+=6;}}
 return {pdf,line,gap:()=>{y+=6;},buffer:()=>Buffer.from(pdf.output('arraybuffer'))};
}
export function invoicePdf(i){
 const s=i.snapshot,{line,gap,buffer}=document(i.status==='draft'?'DRAFT INVOICE':'INVOICE',s.company);
 line(i.number,true);line('Billing period: '+i.period.slice(0,7));line('Issued: '+i.issue_date+'   Due: '+i.due_date);gap();line('Bill to: '+s.name,true);line(s.email);if(s.address)line(s.address);if(s.reference)line('Contract / reference: '+s.reference);gap();
 line(s.pricing==='per_student'?`${i.quantity} contracted students x ${money(i.unit_cents)} / month`:`Monthly CompassU subscription: ${money(i.unit_cents)}`);
 line('Invoice total: '+money(i.total_cents),true);line('Payments recorded: '+money(i.paid_cents));line('Remaining balance: '+money(i.total_cents-i.paid_cents),true);gap();
 if(s.payment_instructions){line('Payment instructions',true);line(s.payment_instructions);}else line('Please contact CompassU to arrange payment.');line('Billing contact: '+s.contact_email);line('Reference invoice '+i.number+' with your payment.');if(i.status==='void')line('VOID — no payment is due.',true);
 return buffer();
}
export function statementPdf(c,invoices,payments,month,settings){
 const st=statementData(c,invoices,payments,month),{line,gap,buffer}=document('MONTHLY ACCOUNT STATEMENT',settings.company);
 line(c.name,true);line(c.email);line('Statement month: '+month);line('Opening balance: '+money(st.opening));gap();
 for(const i of st.charges)line(`${i.issue_date} | ${i.number} | Charge ${money(i.total_cents)}`);
 for(const p of st.receipts){const i=invoices.find(i=>i.id===p.invoice_id);line(`${p.paid_on} | Payment ${money(p.amount_cents)} | ${i?.number||''}${p.reference?' | '+p.reference:''}`);}
 if(!st.charges.length&&!st.receipts.length)line('No transactions in this month.');gap();line('Closing balance: '+money(st.closing),true);gap();line('Open invoices at month end',true);
 for(const i of st.open)line(`${i.number} | Due ${i.due_date} | Remaining ${money(i.balance)}`);
 if(!st.open.length)line('No outstanding invoices at month end.');gap();line(settings.payment_instructions||'Contact CompassU to arrange payment.');line('Billing contact: '+settings.contact_email);return buffer();
}
