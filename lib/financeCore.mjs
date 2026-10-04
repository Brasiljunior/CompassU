export function cents(value) {
 const s=String(value??'').trim();
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw new Error('Enter a positive amount with at most two decimal places.');
 const [whole,decimal='']=s.split('.'); const n=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n<=0||n>100000000000) throw new Error('Amount is outside the supported range.');
 return n;
}
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0)/100);
export function dateOnly(value) {
 const s=String(value||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(new Date(s+'T12:00:00Z').getTime())||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s||s<'2000-01-01'||s>'2100-12-31')throw new Error('Enter a valid date.'); return s;
}
export function chicagoToday(now=new Date()) {const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(t=>p.find(x=>x.type===t).value).join('-');}
export function nextBilling(c,today) {
 dateOnly(today);dateOnly(c.starts_on);
 const day=String(c.billing_day).padStart(2,'0');
 const anchor=today>c.starts_on?today:c.starts_on;
 let candidate=anchor.slice(0,7)+'-'+day;
 if(candidate<anchor){const d=new Date(anchor.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);candidate=d.toISOString().slice(0,7)+'-'+day;}
 return candidate;
}
export function statementData(customer,invoices,payments,month){
 if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Choose a statement month.');
 const start=dateOnly(month+'-01'),d=new Date(start+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);const end=d.toISOString().slice(0,10);
 const eligible=invoices.filter(i=>i.customer_id===customer.id&&i.status==='issued'&&i.issue_date<end);
 const ids=new Set(eligible.map(i=>i.id));const ps=payments.filter(p=>ids.has(p.invoice_id)&&p.paid_on<end);
 const opening=eligible.filter(i=>i.issue_date<start).reduce((s,i)=>s+i.total_cents,0)-ps.filter(p=>p.paid_on<start).reduce((s,p)=>s+p.amount_cents,0);
 const charges=eligible.filter(i=>i.issue_date>=start);const receipts=ps.filter(p=>p.paid_on>=start);
 return {month,start,end,opening,charges,receipts,closing:opening+charges.reduce((s,i)=>s+i.total_cents,0)-receipts.reduce((s,p)=>s+p.amount_cents,0),open:eligible.map(i=>({...i,balance:i.total_cents-ps.filter(p=>p.invoice_id===i.id).reduce((s,p)=>s+p.amount_cents,0)})).filter(i=>i.balance>0)};
}
export function summary(data,today,month){
 const live=data.invoices.filter(i=>i.status==='issued'),receipts=data.payments.filter(p=>p.invoice_id&&p.paid_on.startsWith(month));const spent=data.payments.filter(p=>p.expense_id&&p.paid_on.startsWith(month));
 return {billed:live.filter(i=>i.issue_date.startsWith(month)).reduce((s,i)=>s+i.total_cents,0),collected:receipts.reduce((s,p)=>s+p.amount_cents,0),outstanding:live.reduce((s,i)=>s+i.total_cents-i.paid_cents,0),overdue:live.filter(i=>i.due_date<today).reduce((s,i)=>s+i.total_cents-i.paid_cents,0),payable:data.expenses.filter(e=>e.status==='open').reduce((s,e)=>s+e.total_cents-e.paid_cents,0),spent:spent.reduce((s,p)=>s+p.amount_cents,0)};
}
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function companyStatement(data,month) {
 const start=dateOnly(month+'-01');
 const next=new Date(start+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
 const end=next.toISOString().slice(0,10),yearStart=month.slice(0,4)+'-01-01';
 const invoices=data.invoices.filter(i=>i.status==='issued'&&i.issue_date<end);
 const invoiceMap=new Map(invoices.map(i=>[i.id,i]));
 const expenseMap=new Map(data.expenses.filter(e=>e.status==='open').map(e=>[e.id,e]));
 const receipts=data.payments.filter(p=>invoiceMap.has(p.invoice_id)&&p.paid_on<end);
 const costs=data.payments.filter(p=>expenseMap.has(p.expense_id)&&p.paid_on<end);
 const total=rows=>rows.reduce((s,p)=>s+p.amount_cents,0);
 const monthly=rows=>rows.filter(p=>p.paid_on>=start);
 const income=total(monthly(receipts)),expenses=total(monthly(costs));
 const groups=(rows,label)=>{const m=new Map();for(const p of rows){const key=label(p);m.set(key,(m.get(key)||0)+p.amount_cents);}return [...m].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name));};
 const transactions=[...monthly(receipts).map(p=>({...p,type:'Income',name:invoiceMap.get(p.invoice_id).snapshot.name,document:invoiceMap.get(p.invoice_id).number})),...monthly(costs).map(p=>({...p,type:'Expense',name:expenseMap.get(p.expense_id).vendor,document:expenseMap.get(p.expense_id).description}))].sort((a,b)=>a.paid_on.localeCompare(b.paid_on)||String(a.id).localeCompare(String(b.id)));
 return {month,start,end,income,expenses,net:income-expenses,ytdIncome:total(receipts.filter(p=>p.paid_on>=yearStart)),ytdExpenses:total(costs.filter(p=>p.paid_on>=yearStart)),billed:invoices.filter(i=>i.issue_date>=start).reduce((s,i)=>s+i.total_cents,0),receivable:invoices.reduce((s,i)=>s+i.total_cents,0)-total(receipts),incomeByInstitution:groups(monthly(receipts),p=>invoiceMap.get(p.invoice_id).snapshot.name),expensesByCategory:groups(monthly(costs),p=>expenseMap.get(p.expense_id).category||'Operations'),transactions};
}

export function annualOverview(data,year,today=chicagoToday()) {
 if(!/^\d{4}$/.test(String(year)))throw new Error('Choose a reporting year.');
 dateOnly(String(year)+'-01-01');dateOnly(today);
 const recorded={...data,payments:data.payments.filter(p=>p.paid_on<=today)};
 const months=Array.from({length:12},(_,i)=>{const month=String(year)+'-'+String(i+1).padStart(2,'0');const s=companyStatement(recorded,month);return {month,income:s.income,expenses:s.expenses,net:s.net};});
 const income=months.reduce((sum,m)=>sum+m.income,0),expenses=months.reduce((sum,m)=>sum+m.expenses,0);
 return {year:String(year),months,income,expenses,net:income-expenses};
}
