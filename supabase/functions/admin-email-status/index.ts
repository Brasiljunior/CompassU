import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const normalize=(v:any)=>String(v||'').trim().toLowerCase();
const statusLabel=(event:string)=>{const e=normalize(event);if(['delivered','opened','clicked'].includes(e))return 'Delivered';if(['bounced','failed','suppressed'].includes(e))return 'Failed';if(e==='complained')return 'Complained';if(e==='delivery_delayed'||e==='delayed')return 'Delayed';return 'Pending delivery'};
const pending=(v:any)=>['submitted','pending delivery','pending verification','delayed','sent'].includes(normalize(v));

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization');
  if(!auth)return json({error:'Missing authorization'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,resendKey=Deno.env.get('RESEND_API_KEY');
  if(!resendKey)return json({error:'RESEND_API_KEY is not configured.'},500);
  const userRes=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:auth}});
  if(!userRes.ok)return json({error:'Invalid user session'},401);
  const current=await userRes.json(),serviceHeaders={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
  const admins=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${current.id}&select=user_id&limit=1`,{headers:serviceHeaders}).then(r=>r.json());
  if(!Array.isArray(admins)||!admins.length)return json({error:'Administrator access is not enabled for this account.'},403);
  const body=await req.json().catch(()=>({}));

  if(body.action==='list_reports'){
   const r=await fetch(`${url}/rest/v1/batch_invitation_reports?select=batch_id,file_name,total_count,created_at,updated_at&order=created_at.desc&limit=25`,{headers:serviceHeaders}),reports=await r.json();
   if(!r.ok)return json({error:reports?.message||'Unable to load batch verification reports.'},500);
   const ids=(reports||[]).map((x:any)=>x.batch_id);
   let items:any[]=[];
   if(ids.length){const ir=await fetch(`${url}/rest/v1/batch_invitation_report_items?select=batch_id,status&batch_id=in.(${ids.join(',')})`,{headers:serviceHeaders});items=await ir.json();if(!ir.ok)items=[]}
   return json({ok:true,reports:(reports||[]).map((report:any)=>{const own=items.filter((x:any)=>x.batch_id===report.batch_id);return {...report,delivered:own.filter((x:any)=>x.status==='Delivered').length,failed:own.filter((x:any)=>x.status==='Failed').length,pending:own.filter((x:any)=>pending(x.status)).length}})});
  }

  let storedReport:any=null,storedItems:any[]=[];
  if(body.action==='get_report'){
   const batchId=String(body.batch_id||'');
   if(!batchId)return json({error:'A batch report is required.'},400);
   const rr=await fetch(`${url}/rest/v1/batch_invitation_reports?batch_id=eq.${encodeURIComponent(batchId)}&select=batch_id,file_name,total_count,created_at&limit=1`,{headers:serviceHeaders}),reports=await rr.json();
   if(!rr.ok||!reports?.length)return json({error:'Batch verification report was not found.'},404);
   storedReport=reports[0];
   const ir=await fetch(`${url}/rest/v1/batch_invitation_report_items?batch_id=eq.${encodeURIComponent(batchId)}&select=*&order=row_number.asc`,{headers:serviceHeaders});storedItems=await ir.json();
   if(!ir.ok)return json({error:storedItems?.message||'Unable to load batch verification report.'},500);
  }

  const rawItems=storedItems.length?storedItems:Array.isArray(body.items)?body.items:[];
  const items=rawItems.map((x:any)=>({email:normalize(x?.email),resend_id:String(x?.resend_id||'').trim(),source:x})).filter((x:any)=>x.email);
  if(!items.length)return storedReport?json({ok:true,report:storedReport,results:[]}):json({error:'No email messages supplied.'},400);
  if(items.length>500)return json({error:'A maximum of 500 email messages can be checked at once.'},400);
  const results=await Promise.all(items.map(async(item:any)=>{
   const base=item.source||{};
   if(!pending(base.status))return {...base,email:item.email,resend_id:item.resend_id||null};
   if(!item.resend_id)return {...base,email:item.email,status:'Pending delivery',event:null,message:'Waiting for a Resend message identifier before final delivery can be checked.',resend_id:null};
   try{
    const r=await fetch(`https://api.resend.com/emails/${encodeURIComponent(item.resend_id)}`,{headers:{Authorization:`Bearer ${resendKey}`}}),d=await r.json().catch(()=>({}));
    if(!r.ok)return {...base,email:item.email,status:'Pending delivery',event:null,message:String(d?.message||d?.error||`Resend status lookup failed with ${r.status}`),resend_id:item.resend_id,lookup_error:true};
    const event=normalize(d?.last_event),status=statusLabel(event);
    let message='Resend accepted the email; final delivery has not yet been confirmed.';
    if(status==='Delivered')message='Confirmed delivered by the recipient mail server.';
    else if(status==='Failed'&&event==='bounced')message='Failed: the recipient mail server rejected this email as undeliverable.';
    else if(status==='Failed'&&event==='suppressed')message='Failed: this address was suppressed because of prior delivery problems.';
    else if(status==='Failed')message='Failed: Resend could not deliver this email.';
    else if(status==='Complained')message='The recipient reported this email as spam.';
    else if(status==='Delayed')message='Delivery has been delayed by the recipient mail server.';
    return {...base,email:item.email,status,event:event||null,message,resend_id:item.resend_id,provider_created_at:d?.created_at||null};
   }catch(e){return {...base,email:item.email,status:'Pending delivery',event:null,message:String((e as any)?.message||e),resend_id:item.resend_id,lookup_error:true}}
  }));
  if(storedReport&&results.length){
   const now=new Date().toISOString(),updates=results.map((x:any)=>({batch_id:storedReport.batch_id,row_number:x.row_number,first_name:x.first_name||'',last_name:x.last_name||'',email:x.email,status:x.status,message:x.message||'',event:x.event||null,resend_id:x.resend_id||null,updated_at:now}));
   await fetch(`${url}/rest/v1/batch_invitation_report_items?on_conflict=batch_id,email`,{method:'POST',headers:{...serviceHeaders,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(updates)});
   await fetch(`${url}/rest/v1/batch_invitation_reports?batch_id=eq.${encodeURIComponent(storedReport.batch_id)}`,{method:'PATCH',headers:{...serviceHeaders,Prefer:'return=minimal'},body:JSON.stringify({updated_at:now})});
  }
  return json({ok:true,report:storedReport,results});
 }catch(e){return json({error:String((e as any)?.message||e)},500)}
});
