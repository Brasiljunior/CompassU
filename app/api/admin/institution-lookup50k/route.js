import { NextResponse } from 'next/server';

export const runtime='nodejs';
export const maxDuration=30;

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_PUBLIC_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceHeaders=()=>({apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`});
const readJson=async r=>{try{return await r.json()}catch{return null}};

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

const sanitizeFilterValue=v=>String(v||'').replace(/[(),]/g,'').trim();

export async function POST(request){
  try{
    const auth=await authorize(request);if(auth.error)return auth.error;
    const body=await request.json().catch(()=>({}));
    const emails=[...new Set((Array.isArray(body.emails)?body.emails:[]).map(v=>String(v||'').trim().toLowerCase()).filter(Boolean))].slice(0,100);
    if(!emails.length)return NextResponse.json({institutions:{}});

    // Query only the visible-page emails, in bounded groups. Using an OR filter avoids
    // relying on quoted PostgREST `in.(...)` parsing for addresses that contain `+`.
    const institutions={};
    for(let i=0;i<emails.length;i+=20){
      const chunk=emails.slice(i,i+20);
      const url=new URL(`${SUPABASE_URL}/rest/v1/account_institutions`);
      url.searchParams.set('select','email,institution');
      url.searchParams.set('or',`(${chunk.map(v=>`email.ilike.${sanitizeFilterValue(v)}`).join(',')})`);
      const r=await fetch(url,{headers:serviceHeaders(),cache:'no-store'});
      const rows=await readJson(r);
      if(!r.ok)throw new Error(rows?.message||rows?.error||'Unable to load institution associations.');
      for(const row of Array.isArray(rows)?rows:[]){
        const email=String(row?.email||'').trim().toLowerCase();
        const institution=String(row?.institution||'').trim();
        if(email&&institution)institutions[email]=institution;
      }
    }
    return NextResponse.json({institutions});
  }catch(error){return NextResponse.json({error:error?.message||'Unable to load institution associations.'},{status:500})}
}
