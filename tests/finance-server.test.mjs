import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {requireFinanceAdmin,sendInvoice} from '../lib/financeServer.js';
import {invoicePdf,statementPdf} from '../lib/financePdf.js';
const id='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222';
const token=aal=>`x.${Buffer.from(JSON.stringify({sub:id,aal})).toString('base64url')}.x`;
const request=aal=>new Request('http://localhost/api/admin/finance',{headers:{Authorization:'Bearer '+token(aal)}});
test('finance rejects absent, expired, non-MFA and non-master sessions',async()=>{
 await assert.rejects(()=>requireFinanceAdmin(new Request('http://localhost')),e=>e.status===401);
 const original=global.fetch;try{global.fetch=async()=>new Response('{}',{status:401});await assert.rejects(()=>requireFinanceAdmin(request('aal2')),e=>e.status===401);
 global.fetch=async url=>new Response(JSON.stringify(url.includes('/auth/v1/user')?{id}:false));await assert.rejects(()=>requireFinanceAdmin(request('aal1')),e=>e.status===403);await assert.rejects(()=>requireFinanceAdmin(request('aal2')),e=>e.status===403);
 global.fetch=async url=>new Response(JSON.stringify(url.includes('/auth/v1/user')?{id}:true));assert.equal((await requireFinanceAdmin(request('aal2'))).id,id);
 }finally{global.fetch=original;}
});
const invoice={id,number:'CU-TEST',customer_id:cid,period:'2026-10-01',issue_date:'2026-10-01',due_date:'2026-10-31',status:'issued',snapshot:{company:'CompassU',name:'Example Institution',email:'billing@example.invalid',address:'123 Example Street',reference:'CONTRACT-TEST',pricing:'per_student',contact_email:'billing@example.invalid',payment_instructions:'Contact billing to arrange payment. Include invoice number.'},quantity:17,unit_cents:1299,total_cents:22083,paid_cents:5000};
const data={invoices:[invoice],customers:[{id:cid,name:invoice.snapshot.name,email:invoice.snapshot.email}],payments:[{invoice_id:id,amount_cents:5000,paid_on:'2026-10-03',reference:'TEST'}],settings:invoice.snapshot};
test('invoice and statement PDFs are valid and contain balances',()=>{const a=invoicePdf(invoice),b=statementPdf(data.customers[0],data.invoices,data.payments,'2026-10',data.settings);assert.equal(a.subarray(0,4).toString(),'%PDF');assert.equal(b.subarray(0,4).toString(),'%PDF');fs.writeFileSync('/tmp/compassu-finance-invoice.pdf',a);fs.writeFileSync('/tmp/compassu-finance-statement.pdf',b);});
test('email sends frozen payload, PDF attachments and stable idempotency key',async()=>{const original=global.fetch;process.env.SUPABASE_SERVICE_ROLE_KEY='mock-service';process.env.RESEND_API_KEY='mock-resend';let sent=0;try{global.fetch=async(url,options)=>{if(url.includes('finance_claim_delivery')){const body=JSON.parse(options.body);assert.equal(body.p_payload.attachments.length,2);return Response.json({claimed:true,payload:{...body.p_payload,subject:'Frozen test payload'}});}if(url==='https://api.resend.com/emails'){sent++;assert.equal(options.headers['Idempotency-Key'],'compassu-bill/'+id);assert.equal(JSON.parse(options.body).subject,'Frozen test payload');return Response.json({id:'provider-test'});}return Response.json(null);};assert.equal((await sendInvoice(id,null,data)).status,'sent');assert.equal(sent,1);
 global.fetch=async()=>Response.json({claimed:false,status:'sent'});assert.equal((await sendInvoice(id,null,data)).status,'sent');assert.equal(sent,1);
 }finally{global.fetch=original;delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.RESEND_API_KEY;}});
