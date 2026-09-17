import { NextResponse } from 'next/server';

export const runtime='nodejs';
export const maxDuration=60;

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const TARGET=`${SUPABASE_URL}/functions/v1/admin-console-50k`;

export async function POST(request){
  try{
    const authorization=request.headers.get('authorization');
    if(!authorization)return NextResponse.json({error:'Missing authorization'},{status:401});
    const body=await request.text();
    const response=await fetch(TARGET,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body,cache:'no-store'});
    const contentType=response.headers.get('content-type')||'application/json';
    const payload=await response.arrayBuffer();
    return new NextResponse(payload,{status:response.status,headers:{'Content-Type':contentType,'Cache-Control':'no-store'}});
  }catch(error){
    return NextResponse.json({error:error?.message||'Administrator request failed.'},{status:500});
  }
}
