import { NextResponse } from 'next/server';

export const runtime='nodejs';
export const maxDuration=60;

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';

async function readJson(r){try{return await r.json()}catch{return null}}

export async function POST(request){
  try{
    const authorization=request.headers.get('authorization');
    if(!authorization)return NextResponse.json({error:'Missing authorization'},{status:401});
    const body=await request.json().catch(()=>({}));
    const raw=Array.isArray(body.assignments)?body.assignments:[];
    if(raw.length>500)return NextResponse.json({error:'A maximum of 500 institution associations may be synced at once.'},{status:400});
    const r=await fetch(`${SUPABASE_URL}/functions/v1/admin-institution-sync50k`,{
      method:'POST',
      headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:authorization,'Content-Type':'application/json'},
      body:JSON.stringify({assignments:raw}),
      cache:'no-store'
    });
    const data=await readJson(r);
    if(!r.ok)return NextResponse.json(data||{error:'Unable to save institution associations.'},{status:r.status});
    return NextResponse.json(data||{ok:true,synced:0});
  }catch(error){
    return NextResponse.json({error:error?.message||'Unable to sync institution associations.'},{status:500});
  }
}
