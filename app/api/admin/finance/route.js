import {NextResponse} from 'next/server';
import {requireFinanceAdmin,overview,mutate,generate,pdfDocument,sendInvoice} from '../../../../lib/financeServer';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
function error(e){console.error('Finance API',e.status||500,e.message);return NextResponse.json({error:e.status?e.message:'Finance could not complete this request. Please try again.'},{status:e.status||500,headers});}
export async function GET(request){try{await requireFinanceAdmin(request);const p=new URL(request.url).searchParams;if(p.has('document')){const d=await pdfDocument(p.get('document'),p.get('id'),p.get('month'));return new Response(d.buffer,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${d.filename}"`}});}return NextResponse.json(await overview(),{headers});}catch(e){return error(e);}}
export async function POST(request){try{const user=await requireFinanceAdmin(request);const body=await request.json();const {action,data={}}=body;let result;if(action==='generate')result={count:await generate(data.month,user.id)};else if(action==='send')result=await sendInvoice(data.id,user.id);else result=await mutate(action,data,user.id);return NextResponse.json({result},{headers});}catch(e){return error(e);}}
