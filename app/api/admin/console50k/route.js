import { NextResponse } from 'next/server';

export const runtime='nodejs';
export const maxDuration=60;

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY=process.env.RESEND_API_KEY;
const REPORT_FROM=process.env.COMPASSU_FROM_EMAIL||'CompassU <results@getcompassu.com>';
const APP_URL=(process.env.COMPASSU_APP_URL||'https://getcompassu.com').replace(/\/$/,'');

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));
const csv=v=>`"${String(v??'').replaceAll('"','""')}"`;
const serviceHeaders=()=>({apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json'});

async function readJson(response){try{return await response.json()}catch{return null}}
async function rpc(name,payload={}){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify(payload),cache:'no-store'});
  const d=await readJson(r);
  if(!r.ok)throw new Error(d?.message||d?.hint||d?.error||`${name} failed (${r.status})`);
  return d;
}
async function audit(adminId,action,target=null,details={}){
  await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log`,{method:'POST',headers:{...serviceHeaders(),Prefer:'return=minimal'},body:JSON.stringify({admin_user_id:adminId,action,target_user_id:target,details}),cache:'no-store'});
}
async function identity(id){return rpc('admin_account_identity_50k',{p_user_id:id})}

async function authorize(request){
  if(!SERVICE_ROLE_KEY)return {error:NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY is not configured.'},{status:500})};
  const authorization=request.headers.get('authorization');
  if(!authorization)return {error:NextResponse.json({error:'Missing authorization'},{status:401})};
  const ur=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:authorization},cache:'no-store'});
  if(!ur.ok)return {error:NextResponse.json({error:'Invalid user session'},{status:401})};
  const me=await ur.json();
  const ar=await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${me.id}&select=user_id,role&limit=1`,{headers:serviceHeaders(),cache:'no-store'});
  const admins=await readJson(ar);
  if(!ar.ok||!admins?.length)return {error:NextResponse.json({error:'Administrator access is not enabled for this account.'},{status:403})};
  return {authorization,me,admin:admins[0]};
}

export async function POST(request){
  try{
    const auth=await authorize(request);
    if(auth.error)return auth.error;
    const {me,admin}=auth;
    const body=await request.json().catch(()=>({}));
    const action=body.action||'overview';

    if(action==='overview'||action==='refresh'){
      const page=Math.max(1,Number(body.page||1)||1);
      const pageSize=Math.min(100,Math.max(1,Number(body.page_size||50)||50));
      const search=String(body.search||'').trim()||null;
      const institution=String(body.institution||'').trim()||null;
      const [overview,accounts]=await Promise.all([
        rpc('admin_dashboard_overview_50k'),
        rpc('admin_account_page_50k',{p_page:page,p_page_size:pageSize,p_search:search,p_institution:institution})
      ]);
      return NextResponse.json({admin:{role:admin.role},stats:overview?.stats||{},trend:overview?.trend||[],users:accounts?.users||[],pagination:accounts?.pagination||{page,page_size:pageSize,total:0,total_pages:1,has_previous:false,has_next:false}});
    }

    if(action==='account_page'){
      const page=Math.max(1,Number(body.page||1)||1);
      const pageSize=Math.min(100,Math.max(1,Number(body.page_size||50)||50));
      const search=String(body.search||'').trim()||null;
      const institution=String(body.institution||'').trim()||null;
      return NextResponse.json(await rpc('admin_account_page_50k',{p_page:page,p_page_size:pageSize,p_search:search,p_institution:institution}));
    }

    if(action==='institution_list'){
      return NextResponse.json({institutions:await rpc('admin_institution_list_50k')});
    }

    if(action==='export_accounts'){
      const search=String(body.search||'').trim()||null;
      const institution=String(body.institution||'').trim()||null;
      const lines=[['Name','Email','Institution','State','Created','Last Sign In','Completed Surveys','Last Completed','Status'].map(csv).join(',')];
      let page=1,totalPages=1,total=0;
      do{
        const batch=await rpc('admin_account_export_page_50k',{p_page:page,p_page_size:1000,p_search:search,p_institution:institution});
        totalPages=Number(batch?.pagination?.total_pages||1);
        total=Number(batch?.pagination?.total||0);
        for(const u of batch?.users||[]){
          lines.push([[u.first_name,u.last_name].filter(Boolean).join(' '),u.email,u.institution,u.state,u.created_at,u.last_sign_in_at,u.completed_surveys,u.last_completed_at,u.is_suspended?'Suspended':'Active'].map(csv).join(','));
        }
        page+=1;
        if(page>100)throw new Error('Export safety limit exceeded.');
      }while(page<=totalPages);
      await audit(me.id,'export_accounts',null,{total,search:search||'',institution:institution||''});
      return new NextResponse(lines.join('\n'),{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="CompassU-Admin-Accounts.csv"','Cache-Control':'no-store'}});
    }

    if(action==='invite_user'){
      const email=String(body.email||'').trim().toLowerCase();
      if(!email)return NextResponse.json({error:'Email is required.'},{status:400});
      if(await rpc('admin_account_email_exists_50k',{p_email:email}))return NextResponse.json({error:'This email already has a CompassU account.'},{status:409});
      const firstName=String(body.first_name||''),lastName=String(body.last_name||'');
      const r=await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify({type:'invite',email,data:{first_name:firstName,last_name:lastName,compassu_account_setup_required:true},redirect_to:`${APP_URL}/accept-invite`})});
      const d=await readJson(r);
      if(!r.ok)throw new Error(d?.msg||d?.message||'Unable to create invitation');
      const token=d?.properties?.hashed_token||d?.hashed_token;
      if(!token)throw new Error('Invitation token could not be generated.');
      const link=`${APP_URL}/accept-invite?token_hash=${encodeURIComponent(token)}&type=invite`;
      const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>CompassU</h1><h2>You’re invited to discover your direction.</h2><p>${esc(firstName)||'Hello'}, you’ve been invited to create your CompassU account and complete the career and college discovery assessment.</p><p style="margin:28px 0"><a href="${link}" style="background:#2f6fed;color:white;text-decoration:none;padding:15px 25px;border-radius:12px;font-weight:800">Create My CompassU Account →</a></p><p>If you were not expecting this invitation, you can ignore this email.</p></div>`;
      const rr=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:REPORT_FROM,to:[email],subject:'You’re Invited to CompassU 🧭',html})});
      const rd=await readJson(rr);
      if(!rr.ok)throw new Error(rd?.message||'Unable to send invitation');
      const userId=d?.user?.id||d?.id||null;
      await audit(me.id,'invite_user',userId,{email,batch:false});
      return NextResponse.json({ok:true,message:'Invitation sent.'});
    }

    if(action==='user_detail'){
      const id=String(body.user_id||'');
      const account=await identity(id);
      if(!account?.id)return NextResponse.json({error:'Account not found.'},{status:404});
      const [profile,attempts]=await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,first_name,last_name,state,created_at&limit=1`,{headers:serviceHeaders(),cache:'no-store'}).then(readJson),
        fetch(`${SUPABASE_URL}/rest/v1/assessment_attempts?user_id=eq.${encodeURIComponent(id)}&select=id,status,started_at,completed_at&order=started_at.desc&limit=100`,{headers:serviceHeaders(),cache:'no-store'}).then(readJson)
      ]);
      return NextResponse.json({user:{...account,...(profile?.[0]||{})},attempts:Array.isArray(attempts)?attempts:[]});
    }

    if(action==='password_reset'){
      const id=String(body.user_id||'');
      const u=await identity(id);
      if(!u?.email)return NextResponse.json({error:'Account email not found'},{status:404});
      const r=await fetch(`${SUPABASE_URL}/auth/v1/recover`,{method:'POST',headers:{apikey:SUPABASE_PUBLIC_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:u.email})});
      if(!r.ok)return NextResponse.json({error:'Unable to send password reset'},{status:r.status});
      await audit(me.id,'password_reset',id,{email:u.email});
      return NextResponse.json({ok:true,message:'Password reset email sent.'});
    }

    if(action==='suspend_user'||action==='reactivate_user'){
      const id=String(body.user_id||'');
      const r=await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'PUT',headers:serviceHeaders(),body:JSON.stringify({ban_duration:action==='suspend_user'?'876000h':'none'})});
      if(!r.ok)return NextResponse.json({error:'Unable to update account status'},{status:r.status});
      await audit(me.id,action,id,{});
      return NextResponse.json({ok:true,message:action==='suspend_user'?'Account suspended.':'Account reactivated.'});
    }

    if(action==='delete_user'){
      const id=String(body.user_id||'');
      if(String(body.confirm||'')!=='DELETE')return NextResponse.json({error:'Type DELETE to confirm permanent account removal.'},{status:400});
      const r=await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`,{method:'DELETE',headers:serviceHeaders()});
      if(!r.ok)return NextResponse.json({error:'Unable to remove account'},{status:r.status});
      await audit(me.id,'delete_user',id,{});
      return NextResponse.json({ok:true,message:'Account permanently removed.'});
    }

    if(action==='audit_log'){
      const r=await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log?select=id,action,target_user_id,details,created_at&order=created_at.desc&limit=100`,{headers:serviceHeaders(),cache:'no-store'});
      const rows=await readJson(r);
      return NextResponse.json({rows:Array.isArray(rows)?rows:[]});
    }

    return NextResponse.json({error:'Unknown administrator action'},{status:400});
  }catch(error){
    return NextResponse.json({error:error?.message||'Administrator request failed.'},{status:500});
  }
}
