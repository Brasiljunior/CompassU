import { NextResponse } from 'next/server';

export const runtime='nodejs';
export const maxDuration=60;

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;

async function readJson(r){try{return await r.json()}catch{return null}}
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());

export async function POST(request){
  try{
    const authorization=request.headers.get('authorization');
    if(!authorization)return NextResponse.json({error:'Missing authorization'},{status:401});
    if(!SERVICE_ROLE_KEY)return NextResponse.json({error:'Institution synchronization is not configured.'},{status:503});

    const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
      headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:authorization},
      cache:'no-store'
    });
    if(!userResponse.ok)return NextResponse.json({error:'Invalid user session'},{status:401});
    const user=await readJson(userResponse);
    if(!user?.id)return NextResponse.json({error:'Invalid user session'},{status:401});

    const serviceHeaders={apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};
    const adminResponse=await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`,{
      headers:serviceHeaders,
      cache:'no-store'
    });
    const admins=await readJson(adminResponse);
    if(!adminResponse.ok||!Array.isArray(admins)||!admins.length)return NextResponse.json({error:'Administrator access is required.'},{status:403});

    const body=await request.json().catch(()=>({}));
    const raw=Array.isArray(body.assignments)?body.assignments:[];
    if(raw.length>500)return NextResponse.json({error:'A maximum of 500 institution associations may be synced at once.'},{status:400});

    const assignments=[...new Map(raw.map(item=>{
      const email=String(item?.email||'').trim().toLowerCase();
      const institution=String(item?.institution||'').trim();
      return[email,{email,institution,updated_at:new Date().toISOString()}];
    }).filter(([email,row])=>validEmail(email)&&row.institution)).values()];
    if(!assignments.length)return NextResponse.json({ok:true,synced:0});

    const saveResponse=await fetch(`${SUPABASE_URL}/rest/v1/account_institutions?on_conflict=email`,{
      method:'POST',
      headers:{...serviceHeaders,Prefer:'resolution=merge-duplicates,return=representation'},
      body:JSON.stringify(assignments),
      cache:'no-store'
    });
    const saved=await readJson(saveResponse);
    if(!saveResponse.ok)return NextResponse.json({error:saved?.message||saved?.hint||'Unable to save institution associations.'},{status:saveResponse.status});

    return NextResponse.json({ok:true,synced:Array.isArray(saved)?saved.length:assignments.length});
  }catch(error){
    return NextResponse.json({error:error?.message||'Unable to sync institution associations.'},{status:500});
  }
}
