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
 let month=today.slice(0,7),day=String(c.billing_day).padStart(2,'0'),candidate=month+'-'+day;
 if(candidate<today||candidate<c.starts_on){let d=new Date((candidate<c.starts_on?c.starts_on:candidate)+'T12:00:00Z'); if(candidate>=c.starts_on)d.setUTCMonth(d.getUTCMonth()+1);candidate=d.toISOString().slice(0,7)+'-'+day;if(candidate<c.starts_on){d.setUTCMonth(d.getUTCMonth()+1);candidate=d.toISOString().slice(0,7)+'-'+day;}}
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
