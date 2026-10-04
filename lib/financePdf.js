import {jsPDF} from 'jspdf';
import {money,statementData,companyStatement} from './financeCore.mjs';
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

export function companyStatementPdf(data,month){
 const st=companyStatement(data,month),{line,gap,buffer}=document('MONTHLY FINANCIAL STATEMENT',data.settings.company);
 line('Reporting month: '+month,true);line('Cash basis: recorded income received and company bills paid.');
 line('Generated: '+data.today);gap();
 line('Income received: '+money(st.income),true);line('Expenses paid: '+money(st.expenses));line('Net recorded income: '+money(st.net),true);gap();
 line('Year-to-date income: '+money(st.ytdIncome));line('Year-to-date expenses: '+money(st.ytdExpenses));line('Year-to-date net income: '+money(st.ytdIncome-st.ytdExpenses));gap();
 line('Income by institution',true);for(const r of st.incomeByInstitution)line(r.name+': '+money(r.amount));if(!st.incomeByInstitution.length)line('No income recorded.');gap();
 line('Expenses by category',true);for(const r of st.expensesByCategory)line(r.name+': '+money(r.amount));if(!st.expensesByCategory.length)line('No expenses paid.');gap();
 line('Billing reconciliation',true);line('Invoices issued this month: '+money(st.billed));line('Outstanding invoices at month end: '+money(st.receivable));gap();
 line('Monthly payment transactions',true);for(const r of st.transactions)line(`${r.paid_on} | ${r.type} | ${r.name} | ${money(r.amount_cents)} | ${r.document}${r.reference?' | '+r.reference:''}`);if(!st.transactions.length)line('No payment transactions recorded.');gap();
 line('Figures reflect records currently entered in CompassU. Unpaid invoices are excluded from cash income. Current-month statements are month-to-date. This is not a bank balance or a complete balance sheet.');
 return buffer();
}
