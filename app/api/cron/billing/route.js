import {NextResponse} from 'next/server';
import {runBilling} from '../../../../lib/financeServer';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request){const secret=process.env.CRON_SECRET;if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});try{return NextResponse.json(await runBilling(),{headers:{'Cache-Control':'no-store'}});}catch(e){console.error('Monthly billing failed',e.message);return NextResponse.json({error:'Monthly billing could not complete.'},{status:500});}}
