import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const valid=(e:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const auth=req.headers.get('Authorization');
  if(!auth)return json({error:'Missing authorization'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,resend=Deno.env.get('RESEND_API_KEY')!,from=Deno.env.get('COMPASSU_FROM_EMAIL')||'CompassU <results@getcompassu.com>',app=(Deno.env.get('COMPASSU_APP_URL')||'https://getcompassu.com').replace(/\/$/,'');
  const sh={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
  const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:auth}});
  if(!ur.ok)return json({error:'Invalid user session'},401);
  const me=await ur.json();
  const admins=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${me.id}&select=user_id&limit=1`,{headers:sh}).then(r=>r.json());
  if(!admins?.length)return json({error:'Administrator access is not enabled for this account.'},403);
  const body=await req.json().catch(()=>({})),people=Array.isArray(body.people)?body.people:[];
  if(!people.length)return json({error:'No invitation rows were supplied.'},400);
  if(people.length>100)return json({error:'Each server batch is limited to 100 invitations.'},400);
  const batchId=String(body.batch_id||crypto.randomUUID());

  let users:any[]=[],page=1;
  for(;page<=20;page++){const d=await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`,{headers:sh}).then(r=>r.json()),u=d?.users||[];users.push(...u);if(u.length<200)break}
  const existing=new Set(users.map((u:any)=>String(u.email||'').toLowerCase())),seen=new Set(),results:any[]=[],ready:any[]=[];
  for(const raw of people){
   const email=String(raw?.email||'').trim().toLowerCase(),p={...raw,email,first_name:String(raw?.first_name||'').trim(),last_name:String(raw?.last_name||'').trim()};
   if(!valid(email)){results.push({...p,status:'Invalid email',message:'A valid email address is required.'});continue}
   if(seen.has(email)){results.push({...p,status:'Duplicate in batch',message:'Duplicate email in this batch.'});continue}
   seen.add(email);
   if(existing.has(email)){results.push({...p,status:'Already registered',message:'This email already has a CompassU account.'});continue}
   const r=await fetch(`${url}/auth/v1/admin/generate_link`,{method:'POST',headers:sh,body:JSON.stringify({type:'invite',email,data:{first_name:p.first_name,last_name:p.last_name,compassu_account_setup_required:true},redirect_to:`${app}/accept-invite`})}),d=await r.json();
   if(!r.ok){results.push({...p,status:'Failed',message:d?.msg||d?.message||'Unable to create invitation'});continue}
   const token=d?.properties?.hashed_token||d?.hashed_token;
   if(!token){results.push({...p,status:'Failed',message:'Invitation token could not be generated.'});continue}
   const link=`${app}/accept-invite?token_hash=${encodeURIComponent(token)}&type=invite`;
   const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>CompassU</h1><h2>You’re invited to discover your direction.</h2><p>${esc(p.first_name)||'Hello'}, you’ve been invited to create your CompassU account and complete the career and college discovery assessment.</p><p style="margin:28px 0"><a href="${link}" style="background:#2f6fed;color:white;text-decoration:none;padding:15px 25px;border-radius:12px;font-weight:800">Create My CompassU Account →</a></p><p>If you were not expecting this invitation, you can ignore this email.</p></div>`;
   ready.push({...p,user_id:d?.user?.id||d?.id||null,html});
  }
  if(ready.length){
   const rr=await fetch('https://api.resend.com/emails/batch',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json','Idempotency-Key':`compassu-invite-${batchId}-${String(body.chunk_index??0)}`},body:JSON.stringify(ready.map(p=>({from,to:[p.email],subject:'You’re Invited to CompassU 🧭',html:p.html})))}),rd=await rr.json();
   if(!rr.ok){for(const p of ready)results.push({...p,status:'Failed',message:rd?.message||'Email provider rejected the batch.'})}
   else{const ids=Array.isArray(rd?.data)?rd.data:[];ready.forEach((p,i)=>results.push({...p,status:'Sent',message:'Invitation submitted to Resend.',resend_id:ids[i]?.id||null}))}
  }
  const clean=results.map(({html,user_id,...r}:any)=>r),now=new Date().toISOString();
  let reportSaved=false;
  try{
   const reportResponse=await fetch(`${url}/rest/v1/batch_invitation_reports?on_conflict=batch_id`,{method:'POST',headers:{...sh,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({batch_id:batchId,created_by:me.id,file_name:String(body.file_name||'Batch upload').slice(0,240),total_count:Math.min(500,Math.max(people.length,Number(body.total_count)||people.length)),updated_at:now})});
   if(!reportResponse.ok)throw new Error(await reportResponse.text());
   const itemRows=clean.filter((r:any)=>r.email).map((r:any)=>({batch_id:batchId,row_number:Number(r.row)||null,first_name:r.first_name||'',last_name:r.last_name||'',email:r.email,status:r.status,message:r.message||'',event:r.event||null,resend_id:r.resend_id||null,updated_at:now}));
   if(itemRows.length){const itemResponse=await fetch(`${url}/rest/v1/batch_invitation_report_items?on_conflict=batch_id,email`,{method:'POST',headers:{...sh,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(itemRows)});if(!itemResponse.ok)throw new Error(await itemResponse.text())}
   reportSaved=true;
  }catch(e){console.error('Batch verification report could not be persisted',e)}
  return json({ok:true,batch_id:batchId,report_saved:reportSaved,results:clean,summary:{requested:people.length,sent:clean.filter((r:any)=>r.status==='Sent').length,failed:clean.filter((r:any)=>r.status==='Failed').length}});
 }catch(e){return json({error:String((e as any)?.message||e)},500)}
});
