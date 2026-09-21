import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const auth=req.headers.get('Authorization');
    if(!auth)return json({error:'Missing authorization'},401);

    const url=Deno.env.get('SUPABASE_URL')!;
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resend=Deno.env.get('RESEND_API_KEY')!;
    const from=Deno.env.get('COMPASSU_FROM_EMAIL')||'CompassU <results@getcompassu.com>';
    const app=(Deno.env.get('COMPASSU_APP_URL')||'https://getcompassu.com').replace(/\/$/,'');
    const sh={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};

    const ur=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anon,Authorization:auth}});
    if(!ur.ok)return json({error:'Invalid user session'},401);
    const me=await ur.json();

    const ar=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${me.id}&select=user_id,role&limit=1`,{headers:sh});
    const admins=await ar.json();
    if(!admins?.length)return json({error:'Administrator access is not enabled for this account.'},403);

    const body=await req.json().catch(()=>({}));
    const action=body.action||'overview';

    const rpc=async(name:string,payload:any={})=>{
      const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:sh,body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>null);
      if(!r.ok)throw new Error(d?.message||d?.hint||d?.error||`${name} failed (${r.status})`);
      return d;
    };
    const audit=async(a:string,t:any=null,d:any={})=>fetch(`${url}/rest/v1/admin_audit_log`,{method:'POST',headers:{...sh,Prefer:'return=minimal'},body:JSON.stringify({admin_user_id:me.id,action:a,target_user_id:t,details:d})});
    const accountIdentity=async(id:string)=>rpc('admin_account_identity_50k',{p_user_id:id});
    const findIdentityByEmail=async(rawEmail:string)=>{
      const email=String(rawEmail||'').trim().toLowerCase();
      for(let page=1;page<=100;page++){
        const r=await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`,{headers:sh});
        const d=await r.json();
        if(!r.ok)throw new Error(d?.message||'Unable to locate the account.');
        const users=Array.isArray(d?.users)?d.users:[];
        const match=users.find((u:any)=>String(u?.email||'').trim().toLowerCase()===email);
        if(match?.id)return match;
        if(users.length<1000)break;
      }
      throw new Error(`No CompassU account was found for ${email}.`);
    };
    const getEditableAccount=async(id:string)=>{
      const ir=await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`,{headers:sh});
      const identity=await ir.json();
      if(!ir.ok)throw new Error(identity?.message||'Account not found.');
      const email=String(identity?.email||'').trim().toLowerCase();
      const [profiles,institutions]=await Promise.all([
        fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=first_name,last_name,state,graduation_year&limit=1`,{headers:sh}).then(r=>r.json()),
        fetch(`${url}/rest/v1/account_institutions?email=eq.${encodeURIComponent(email)}&select=institution,institution_type,catalog_institution_id&limit=1`,{headers:sh}).then(r=>r.json())
      ]);
      return {id,email,first_name:profiles?.[0]?.first_name||identity?.user_metadata?.first_name||'',last_name:profiles?.[0]?.last_name||identity?.user_metadata?.last_name||'',state:profiles?.[0]?.state||'',graduation_year:profiles?.[0]?.graduation_year||'',institution:institutions?.[0]?.institution||'',institution_type:institutions?.[0]?.institution_type||'high_school',is_suspended:Boolean(identity?.banned_until&&new Date(identity.banned_until)>new Date()),user_metadata:identity?.user_metadata||{}};
    };

    const invite=async(email:string,first_name='',last_name='')=>{
      email=email.trim().toLowerCase();
      const r=await fetch(`${url}/auth/v1/admin/generate_link`,{method:'POST',headers:sh,body:JSON.stringify({type:'invite',email,data:{first_name,last_name,compassu_account_setup_required:true},redirect_to:`${app}/accept-invite`})});
      const d=await r.json();
      if(!r.ok)throw new Error(d?.msg||d?.message||'Unable to create invitation');
      const token=d?.properties?.hashed_token||d?.hashed_token;
      if(!token)throw new Error('Invitation token could not be generated.');
      const link=`${app}/accept-invite?token_hash=${encodeURIComponent(token)}&type=invite`;
      const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>CompassU</h1><h2>You’re invited to discover your direction.</h2><p>${esc(first_name)||'Hello'}, you’ve been invited to create your CompassU account and complete the career and college discovery assessment.</p><p style="margin:28px 0"><a href="${link}" style="background:#2f6fed;color:white;text-decoration:none;padding:15px 25px;border-radius:12px;font-weight:800">Create My CompassU Account →</a></p><p>If you were not expecting this invitation, you can ignore this email.</p></div>`;
      const rr=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:'You’re Invited to CompassU 🧭',html})});
      const rd=await rr.json();
      if(!rr.ok)throw new Error(rd?.message||'Unable to send invitation');
      return {user_id:d?.user?.id||d?.id||null,email,resend_id:rd?.id||null};
    };

    if(action==='invite_user'){
      const email=String(body.email||'').trim().toLowerCase();
      if(!email)return json({error:'Email is required.'},400);
      const exists=await rpc('admin_account_email_exists_50k',{p_email:email});
      if(exists)return json({error:'This email already has a CompassU account.'},409);
      const x=await invite(email,String(body.first_name||''),String(body.last_name||''));
      await audit('invite_user',x.user_id,{email,batch:false});
      return json({ok:true,message:'Invitation sent.'});
    }

    if(action==='overview'||action==='refresh'){
      const page=Math.max(1,Number(body.page||1)||1);
      const pageSize=Math.min(100,Math.max(1,Number(body.page_size||50)||50));
      const search=String(body.search||'').trim()||null;
      const institution=String(body.institution||'').trim()||null;
      const [overview,accounts]=await Promise.all([
        rpc('admin_dashboard_overview_50k',{}),
        rpc('admin_account_page_50k',{p_page:page,p_page_size:pageSize,p_search:search,p_institution:institution})
      ]);
      return json({admin:{role:admins[0].role},stats:overview?.stats||{},trend:overview?.trend||[],users:accounts?.users||[],pagination:accounts?.pagination||{page,page_size:pageSize,total:0,total_pages:1,has_previous:false,has_next:false}});
    }

    if(action==='export_accounts'){
      const search=String(body.search||'').trim()||null;
      const institution=String(body.institution||'').trim()||null;
      const rows:any[]=[];let page=1,totalPages=1;
      do{
        const accounts=await rpc('admin_account_page_50k',{p_page:page,p_page_size:100,p_search:search,p_institution:institution});
        rows.push(...(Array.isArray(accounts?.users)?accounts.users:[]));
        totalPages=Math.max(1,Number(accounts?.pagination?.total_pages||1));page+=1;
      }while(page<=totalPages&&page<=500);
      const q=(v:any)=>`"${String(v??'').replaceAll('"','""')}"`;
      const csv=[['First Name','Last Name','Email','Created','Last Sign In','Survey Status','Access'],...rows.map((u:any)=>[u.first_name||'',u.last_name||'',u.email||'',u.created_at||'',u.last_sign_in_at||'',Number(u.completed_surveys||0)>0?`${u.completed_surveys} completed`:Number(u.in_progress_surveys||0)>0?'In progress':'Not completed',u.is_suspended?'Suspended':'Active'])].map(row=>row.map(q).join(',')).join('\n');
      return new Response('\ufeff'+csv,{status:200,headers:{...cors,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="CompassU-Admin-Accounts.csv"'}});
    }

    if(action==='institution_list'){
      const rows:any[]=[];
      for(let offset=0;offset<50000;offset+=1000){
        const batch=await fetch(`${url}/rest/v1/account_institutions?select=institution&institution=not.is.null&order=institution.asc&limit=1000&offset=${offset}`,{headers:sh}).then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()});
        if(!Array.isArray(batch)||!batch.length)break;
        rows.push(...batch);
        if(batch.length<1000)break;
      }
      const institutions=[...new Set(rows.map(row=>String(row?.institution||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      return json({institutions});
    }

    if(action==='account_page'){
      const page=Math.max(1,Number(body.page||1)||1);
      const pageSize=Math.min(100,Math.max(1,Number(body.page_size||50)||50));
      const search=String(body.search||'').trim()||null;
      const institution=String(body.institution||'').trim()||null;
      const accounts=await rpc('admin_account_page_50k',{p_page:page,p_page_size:pageSize,p_search:search,p_institution:institution});
      return json(accounts||{users:[],pagination:{page,page_size:pageSize,total:0,total_pages:1,has_previous:false,has_next:false}});
    }

    if(action==='load_account_edit'||action==='update_account_edit'){
      if(admins[0].role!=='master_admin')return json({error:'Only a master administrator can edit account records.'},403);
      let id=String(body.user_id||'');
      if(!id&&body.email)id=String((await findIdentityByEmail(body.email)).id||'');
      if(!id)return json({error:'An account id or email is required.'},400);
      if(action==='load_account_edit')return json({account:await getEditableAccount(id)});
      const current=await getEditableAccount(id);
      const email=String(body.email||'').trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid email address.'},400);
      const institution=String(body.institution||'').trim();
      const institutionType=['high_school','community_college','university'].includes(body.institution_type)?body.institution_type:'high_school';
      const graduationYear=body.graduation_year===''||body.graduation_year==null?null:Number(body.graduation_year);
      if(graduationYear!==null&&(!Number.isInteger(graduationYear)||graduationYear<1900||graduationYear>2200))return json({error:'Graduation year must be between 1900 and 2200.'},400);
      const firstName=String(body.first_name||'').trim(),lastName=String(body.last_name||'').trim();
      const authUpdate=await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'PUT',headers:sh,body:JSON.stringify({email,email_confirm:true,ban_duration:body.is_suspended?'876000h':'none',user_metadata:{...(current.user_metadata||{}),first_name:firstName,last_name:lastName}})});
      if(!authUpdate.ok){const d=await authUpdate.json().catch(()=>({}));throw new Error(d?.message||'Unable to update the authentication account.');}
      const profileUpdate=await fetch(`${url}/rest/v1/profiles?on_conflict=id`,{method:'POST',headers:{...sh,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id,first_name:firstName,last_name:lastName,state:String(body.state||'').trim()||null,graduation_year:graduationYear,updated_at:new Date().toISOString()})});
      if(!profileUpdate.ok)throw new Error('Unable to update the account profile.');
      if(institution){
        let catalogId=null;
        if(institutionType!=='high_school'){
          const matches=await fetch(`${url}/rest/v1/institutions?name=eq.${encodeURIComponent(institution)}&select=id&limit=2`,{headers:sh}).then(r=>r.json());
          if(Array.isArray(matches)&&matches.length===1)catalogId=matches[0].id;
        }
        const institutionUpdate=await fetch(`${url}/rest/v1/account_institutions?on_conflict=email`,{method:'POST',headers:{...sh,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({email,institution,institution_type:institutionType,catalog_institution_id:catalogId,updated_at:new Date().toISOString()})});
        if(!institutionUpdate.ok)throw new Error('Unable to update the institution assignment.');
        if(current.email&&current.email!==email)await fetch(`${url}/rest/v1/account_institutions?email=eq.${encodeURIComponent(current.email)}`,{method:'DELETE',headers:sh});
      }else if(current.email)await fetch(`${url}/rest/v1/account_institutions?email=eq.${encodeURIComponent(current.email)}`,{method:'DELETE',headers:sh});
      await audit('update_account_information',id,{email_changed:current.email!==email,institution_type:institutionType,institution_assigned:Boolean(institution),access:body.is_suspended?'suspended':'active'});
      return json({ok:true,account:await getEditableAccount(id),message:'Account information updated.'});
    }

    if(action==='user_detail'){
      const id=String(body.user_id||'');
      if(!id)return json({error:'Account id is required.'},400);
      const identity=await accountIdentity(id);
      if(!identity?.id)return json({error:'Account not found.'},404);
      const [profile,attempts]=await Promise.all([
        fetch(`${url}/rest/v1/profiles?id=eq.${id}&select=id,first_name,last_name,state,created_at&limit=1`,{headers:sh}).then(r=>r.json()),
        fetch(`${url}/rest/v1/assessment_attempts?user_id=eq.${id}&select=id,status,started_at,completed_at&order=started_at.desc&limit=100`,{headers:sh}).then(r=>r.json())
      ]);
      return json({user:{...identity,...(profile?.[0]||{})},attempts:Array.isArray(attempts)?attempts:[]});
    }

    if(action==='password_reset'){
      const id=String(body.user_id||'');
      const u=await accountIdentity(id);
      if(!u?.email)return json({error:'Account email not found'},404);
      const r=await fetch(`${url}/auth/v1/recover`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:u.email})});
      if(!r.ok)return json({error:'Unable to send password reset'},r.status);
      await audit('password_reset',id,{email:u.email});
      return json({ok:true,message:'Password reset email sent.'});
    }

    if(action==='suspend_user'||action==='reactivate_user'){
      const id=String(body.user_id||'');
      const r=await fetch(`${url}/auth/v1/admin/users/${id}`,{method:'PUT',headers:sh,body:JSON.stringify({ban_duration:action==='suspend_user'?'876000h':'none'})});
      if(!r.ok)return json({error:'Unable to update account status'},r.status);
      await audit(action,id,{});
      return json({ok:true,message:action==='suspend_user'?'Account suspended.':'Account reactivated.'});
    }

    if(action==='delete_users'){
      const ids=[...new Set((Array.isArray(body.user_ids)?body.user_ids:[]).map((x:any)=>String(x||'')).filter(Boolean))];
      if(String(body.confirm||'')!=='DELETE')return json({error:'Type DELETE to confirm permanent account removal.'},400);
      if(!ids.length)return json({error:'Select at least one account.'},400);
      if(ids.length>100)return json({error:'Each bulk deletion request is limited to 100 accounts.'},400);
      const adminRows=await fetch(`${url}/rest/v1/admin_users?select=user_id&user_id=in.(${ids.join(',')})`,{headers:sh}).then(r=>r.json());
      const protectedIds=new Set((Array.isArray(adminRows)?adminRows:[]).map((x:any)=>String(x.user_id)));
      protectedIds.add(String(me.id));
      const results:any[]=[];
      for(const id of ids){
        let identity:any=null;
        try{identity=await accountIdentity(id)}catch{}
        if(protectedIds.has(id)){
          results.push({user_id:id,email:identity?.email||'',status:'Failed',message:'Administrator accounts cannot be removed through bulk deletion.'});
          continue;
        }
        try{
          const r=await fetch(`${url}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:sh});
          if(!r.ok){const d=await r.json().catch(()=>({}));results.push({user_id:id,email:identity?.email||'',status:'Failed',message:d?.message||'Unable to remove account.'});continue}
          await audit('delete_user',id,{bulk:true});
          results.push({user_id:id,email:identity?.email||'',status:'Deleted',message:'Account permanently removed.'});
        }catch(e){results.push({user_id:id,email:identity?.email||'',status:'Failed',message:String((e as any)?.message||e)})}
      }
      return json({ok:true,results,summary:{requested:ids.length,deleted:results.filter((x:any)=>x.status==='Deleted').length,failed:results.filter((x:any)=>x.status==='Failed').length}});
    }

    if(action==='delete_user'){
      const id=String(body.user_id||'');
      if(String(body.confirm||'')!=='DELETE')return json({error:'Type DELETE to confirm permanent account removal.'},400);
      const r=await fetch(`${url}/auth/v1/admin/users/${id}`,{method:'DELETE',headers:sh});
      if(!r.ok)return json({error:'Unable to remove account'},r.status);
      await audit('delete_user',id,{});
      return json({ok:true,message:'Account permanently removed.'});
    }

    if(action==='audit_log'){
      const rows=await fetch(`${url}/rest/v1/admin_audit_log?select=id,action,target_user_id,details,created_at&order=created_at.desc&limit=100`,{headers:sh}).then(r=>r.json());
      return json({rows:Array.isArray(rows)?rows:[]});
    }

    return json({error:'Unknown administrator action'},400);
  }catch(e){
    return json({error:String((e as any)?.message||e)},500);
  }
});
