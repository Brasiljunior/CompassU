import { NextResponse } from 'next/server';

export const runtime='nodejs';
export const maxDuration=60;

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceHeaders=()=>({apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json'});

async function readJson(r){try{return await r.json()}catch{return null}}
async function authorize(request){
  if(!SERVICE_ROLE_KEY)return {error:NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY is not configured.'},{status:500})};
  const authorization=request.headers.get('authorization');
  if(!authorization)return {error:NextResponse.json({error:'Missing authorization'},{status:401})};
  const ur=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:authorization},cache:'no-store'});
  if(!ur.ok)return {error:NextResponse.json({error:'Invalid user session'},{status:401})};
  const me=await ur.json();
  const ar=await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(me.id)}&select=user_id&limit=1`,{headers:serviceHeaders(),cache:'no-store'});
  const admins=await readJson(ar);
  if(!ar.ok||!admins?.length)return {error:NextResponse.json({error:'Administrator access is not enabled for this account.'},{status:403})};
  return {me};
}

export async function POST(request){
  try{
    const auth=await authorize(request);if(auth.error)return auth.error;
    const body=await request.json().catch(()=>({}));
    const raw=Array.isArray(body.assignments)?body.assignments:[];
    const deduped=[...new Map(raw.map(item=>{
      const email=String(item?.email||'').trim().toLowerCase();
      const institution=String(item?.institution||'').trim();
      return[email,{email,institution,updated_at:new Date().toISOString()}];
    }).filter(([email,row])=>email&&row.institution)).values()];
    if(!deduped.length)return NextResponse.json({ok:true,synced:0});
    if(deduped.length>500)return NextResponse.json({error:'A maximum of 500 institution associations may be synced at once.'},{status:400});
    const r=await fetch(`${SUPABASE_URL}/rest/v1/account_institutions?on_conflict=email`,{method:'POST',headers:{...serviceHeaders(),Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(deduped),cache:'no-store'});
    if(!r.ok){const d=await readJson(r);throw new Error(d?.message||d?.error||'Unable to save institution associations.');}
    return NextResponse.json({ok:true,synced:deduped.length});
  }catch(error){return NextResponse.json({error:error?.message||'Unable to sync institution associations.'},{status:500})}
}
