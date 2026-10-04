import {cents,dateOnly,chicagoToday,escapeHtml} from './financeCore.mjs';
import {invoicePdf,statementPdf,companyStatementPdf} from './financePdf.js';
const base=()=>process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const publicKey=()=>process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
export class FinanceError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function requireFinanceAdmin(request){
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new FinanceError('Please sign in to the administrator page.',401);
 const headers={apikey:publicKey(),Authorization:`Bearer ${token}`};
 const auth=await fetch(base()+'/auth/v1/user',{headers,cache:'no-store'});if(!auth.ok)throw new FinanceError('Your session expired. Please sign in again.',401);
 const user=await auth.json();let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString())}catch{throw new FinanceError('Invalid session.',401)}
 if(claims.sub!==user.id||claims.aal!=='aal2')throw new FinanceError('Verify administrator multi-factor authentication before using Finance.',403);
 const role=await fetch(base()+'/rest/v1/rpc/is_compassu_master_admin',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',cache:'no-store'});const master=role.ok?await role.json():false;
 if(master!==true)throw new FinanceError('Finance is available to master administrators only.',403);return user;
}
export async function db(path,options={}) {
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)throw new FinanceError('Finance database service is not configured.',503);
 const headers={apikey:key,'Content-Type':'application/json',...(!key.startsWith('sb_secret_')?{Authorization:`Bearer ${key}`}:{}) ,...options.headers};
 const r=await fetch(base()+'/rest/v1/'+path,{...options,headers,cache:'no-store'});const text=await r.text();let body;try{body=text?JSON.parse(text):null}catch{body=null}
 if(!r.ok){console.error('Finance database request failed',path.split('?')[0],r.status,body?.code);throw new FinanceError(body?.code==='23505'?'This record already exists. Refresh to see the saved record.':body?.message||'Finance database operation failed.',r.status>=500?503:400)}return body;
}
const rpc=(name,body)=>db('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
async function all(table,select='*',order='created_at.desc'){
 const result=[];for(let offset=0;;offset+=1000){const rows=await db(`${table}?select=${select}&order=${order}&limit=1000&offset=${offset}`);result.push(...rows);if(rows.length<1000)return result;if(offset>=99000)throw new FinanceError('Finance data requires a larger export. Contact support.',503);}
}
export async function overview(){const [customers,invoices,payments,expenses,deliveries,settings,audit,receipts]=await Promise.all([all('finance_customers'),all('finance_invoices'),all('finance_payments'),all('finance_expenses'),all('finance_deliveries','invoice_id,status,attempts,sent_at,error,provider_id,updated_at','updated_at.desc'),all('finance_settings','*','id'),db('finance_audit?select=id,actor,action,record_id,created_at&order=created_at.desc&limit=100'),all('finance_expense_receipts','id,expense_id,file_name,content_type,size_bytes,created_at')]);return {receipts,customers,invoices,payments,expenses,deliveries,settings:settings[0],audit,today:chicagoToday()};}
const uuid=(v)=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v)))throw new FinanceError('Invalid record identifier.');return v;};
const text=(v,label,max=200,required=true)=>{const s=String(v??'').trim();if((required&&!s)||s.length>max)throw new FinanceError(`${label} is required and must be at most ${max} characters.`);return s;};
const email=v=>{const s=text(v,'Billing email',254);if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)||/[\r\n]/.test(s))throw new FinanceError('Enter one valid billing email address.');return s;};
const integer=(v,label,min,max)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw new FinanceError(`${label} must be between ${min} and ${max}.`);return n;};
export async function mutate(action,input,actor){
 let data;
 if(action==='customer'){const unit_cents=cents(input.amount);if(unit_cents>100000000)throw new FinanceError('The monthly rate cannot exceed $1,000,000.');if(!['fixed','per_student'].includes(input.pricing))throw new FinanceError('Choose a pricing method.');data={id:input.id?uuid(input.id):null,name:text(input.name,'Institution name',160),email:email(input.email),address:text(input.address,'Billing address',1000,false),reference:text(input.reference,'Contract reference',160,false),pricing:input.pricing,unit_cents,quantity:input.pricing==='fixed'?1:integer(input.quantity,'Student quantity',1,100000),starts_on:dateOnly(input.starts_on),billing_day:integer(input.billing_day,'Billing day',1,28),net_days:integer(input.net_days,'Payment terms',0,90),active:input.active===true,auto_send:input.auto_send===true};}
 else if(action==='settings')data={company:text(input.company,'Company name',100),contact_email:email(input.contact_email),payment_instructions:text(input.payment_instructions,'Payment instructions',3000,false)};
 else if(action==='expense')data={vendor:text(input.vendor,'Vendor',160),description:text(input.description,'Bill description',500),category:text(input.category,'Category',100),total_cents:cents(input.amount),due_date:dateOnly(input.due_date)};
 else if(action==='payment'){const paid_on=dateOnly(input.paid_on);if(paid_on>chicagoToday())throw new FinanceError('Record payments on the date actually received or paid.');if(!['invoice','expense'].includes(input.kind))throw new FinanceError('Choose an invoice or company bill.');data={id:uuid(input.id),kind:input.kind,amount_cents:cents(input.amount),paid_on,reference:text(input.reference,'Payment reference',160,true),note:text(input.note,'Payment note',1000,false),request_id:uuid(input.request_id)};}
 else if(['issue','void'].includes(action))data={id:uuid(input.id)};
 else throw new FinanceError('Unknown finance operation.');
 if(action==='customer'&&data.auto_send){const settings=await all('finance_settings','*','id');if(!settings[0]?.payment_instructions?.trim())throw new FinanceError('Save payment instructions before enabling automatic billing.');}
 return rpc('finance_mutate',{p_action:action,p_data:data,p_actor:actor});
}
export async function generate(month,actor){const date=dateOnly(String(month)+'-01');if(date.slice(0,7)>chicagoToday().slice(0,7))throw new FinanceError('Drafts can be generated for the current month or a past month.');return rpc('finance_generate_cycle',{p_day:date,p_automatic:false,p_actor:actor});}
export async function pdfDocument(kind,id,month){const data=await overview();if(kind==='company'){return {buffer:companyStatementPdf(data,month),filename:`CompassU-financial-statement-${month}.pdf`};}if(kind==='invoice'){const i=data.invoices.find(i=>i.id===uuid(id));if(!i)throw new FinanceError('Invoice not found.',404);return {buffer:invoicePdf(i),filename:`${i.number}.pdf`};}if(kind!=='statement')throw new FinanceError('Unknown document.');const c=data.customers.find(c=>c.id===uuid(id));if(!c)throw new FinanceError('Billing account not found.',404);return {buffer:statementPdf(c,data.invoices,data.payments,month,data.settings),filename:`CompassU-statement-${month}.pdf`};}
export async function sendInvoice(id,actor=null,providedData=null){
 uuid(id);const apiKey=process.env.RESEND_API_KEY?.trim();if(!apiKey)throw new FinanceError('Billing email service is not configured.',503);
 const data=providedData||await overview(),i=data.invoices.find(i=>i.id===id);if(!i||i.status!=='issued')throw new FinanceError('Issue the invoice before emailing it.');
 const c=data.customers.find(c=>c.id===i.customer_id),s=i.snapshot;
 if(!s.payment_instructions?.trim())throw new FinanceError('Set payment instructions before generating an invoice for email delivery.');
 const payload={from:process.env.COMPASSU_BILLING_FROM||process.env.COMPASSU_FROM_EMAIL||'CompassU <results@getcompassu.com>',to:[s.email],reply_to:s.contact_email,subject:`${s.company} invoice ${i.number} — ${i.period.slice(0,7)}`,html:`<p>Hello ${escapeHtml(s.name)},</p><p>Your monthly CompassU invoice and account statement are attached.</p><p><strong>Invoice:</strong> ${escapeHtml(i.number)}<br><strong>Due date:</strong> ${i.due_date}<br><strong>Invoice total:</strong> $${(i.total_cents/100).toFixed(2)}<br><strong>Remaining invoice balance:</strong> $${((i.total_cents-i.paid_cents)/100).toFixed(2)}</p><p>${escapeHtml(s.payment_instructions).replace(/\n/g,'<br>')}</p><p>Please include the invoice number with your payment. Questions? Contact ${escapeHtml(s.contact_email)}.</p>`,attachments:[{filename:i.number+'.pdf',content:invoicePdf(i).toString('base64')},{filename:`Statement-${i.period.slice(0,7)}.pdf`,content:statementPdf({...c,name:s.name,email:s.email},data.invoices,data.payments,i.period.slice(0,7),{...data.settings,company:s.company,contact_email:s.contact_email,payment_instructions:s.payment_instructions}).toString('base64')}]};
 const claim=await rpc('finance_claim_delivery',{p_invoice:id,p_payload:payload});if(!claim.claimed)return {status:claim.status};
 let sent;try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`compassu-bill/${id}`},body:JSON.stringify(claim.payload),signal:AbortSignal.timeout(25000)});const body=await response.json();if(!response.ok)throw new Error(`Email service rejected the request (${response.status}).`);sent=body.id;if(!sent)throw new Error('Email service returned no delivery identifier.');}catch(e){await db(`finance_deliveries?invoice_id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status:'failed',error:String(e.message).slice(0,500),updated_at:new Date().toISOString()})});throw new FinanceError('Email could not be confirmed. See delivery history; retries reuse the same delivery identifier.',502);}
 // If persistence fails after provider acceptance, leave the sending claim intact for an idempotent retry.
 await db(`finance_deliveries?invoice_id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status:'sent',provider_id:sent,sent_at:new Date().toISOString(),error:null,updated_at:new Date().toISOString()})});
 await db('finance_audit',{method:'POST',body:JSON.stringify({actor,action:'email_invoice',record_id:id,details:{provider_id:sent,to:s.email}})});return {status:'sent'};
}
export async function runBilling(){
 const settings=await all('finance_settings','*','id');if(!process.env.RESEND_API_KEY||!settings[0]?.payment_instructions?.trim())return {generated:0,sent:0,errors:['Configure billing payment instructions and email delivery before enabling the monthly cycle.']};
 const generated=await rpc('finance_generate_cycle',{p_day:chicagoToday(),p_automatic:true,p_actor:null});const data=await overview();const eligible=data.invoices.filter(i=>i.status==='issued'&&i.auto_send&&i.total_cents>i.paid_cents&&!data.deliveries.some(d=>d.invoice_id===i.id&&['sent','needs_review'].includes(d.status))).sort((a,b)=>{const da=data.deliveries.find(d=>d.invoice_id===a.id),db=data.deliveries.find(d=>d.invoice_id===b.id);return (da?.attempts||0)-(db?.attempts||0)||a.created_at.localeCompare(b.created_at)}).slice(0,8);let sent=0;const errors=[];
 for(const i of eligible){try{const result=await sendInvoice(i.id,null,data);if(result.status==='sent')sent++;else if(result.status==='needs_review')errors.push(`${i.number}: delivery requires review`);}catch(e){errors.push(`${i.number}: ${e.message}`);}}
 return {generated,sent,processed:eligible.length,errors};
}
