import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Independent retry path for completed assessments, even if the student closes the browser.
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)
  return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Delivery service unavailable'},{status:503});
 try{
  const response=await fetch(`${url}/functions/v1/process-institutional-report-deliveries`,{
   method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
   body:JSON.stringify({}),cache:'no-store',signal:AbortSignal.timeout(25000)
  });
  const outcome=await response.json().catch(()=>null);
  if(!response.ok)return NextResponse.json({error:'Institutional delivery processing failed'},{status:502});
  return NextResponse.json({processed:outcome?.processed??0,accepted:outcome?.accepted??0});
 }catch(error){
  console.error('Institutional delivery cron failed',error instanceof Error?error.message:'Unknown error');
  return NextResponse.json({error:'Institutional delivery processing unavailable'},{status:502});
 }
}
