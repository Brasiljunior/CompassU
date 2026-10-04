import {NextResponse} from 'next/server';
import {requireFinanceAdmin,mutate,FinanceError} from '../../../../../lib/financeServer.js';
import {validateReceipt,RECEIPT_MAX_BYTES} from '../../../../../lib/receiptValidation.mjs';
import {attachReceipt,downloadReceipt} from '../../../../../lib/financeReceipts.js';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const fail=e=>NextResponse.json({error:e.status?e.message:'The receipt request could not be completed. Please try again.'},{status:e.status||500,headers});
export async function GET(request){try{await requireFinanceAdmin(request);const r=await downloadReceipt(new URL(request.url).searchParams.get('expense_id'));return new Response(r.buffer,{headers:{...headers,'Content-Type':r.type,'Content-Disposition':`attachment; filename="${r.name.replace(/[^a-zA-Z0-9 _.-]/g,'_')}"`}});}catch(e){return fail(e);}}
export async function POST(request){try{
 const user=await requireFinanceAdmin(request);
 if(Number(request.headers.get('content-length'))>RECEIPT_MAX_BYTES+65536)throw new FinanceError('Receipts must be 3 MB or smaller.',413);
 const form=await request.formData();let file;try{file=await validateReceipt(form.get('receipt'));}catch(e){throw new FinanceError(e.message,400);}
 const expenseId=form.get('expense_id');
 if(expenseId){const receipt=await attachReceipt(expenseId,file,user.id);return NextResponse.json({receipt},{headers});}
 let input;try{input=JSON.parse(form.get('data'));}catch{throw new FinanceError('Company bill details are invalid.');}
 const bill=await mutate('expense',input,user.id);
 try{const receipt=await attachReceipt(bill.id,file,user.id);return NextResponse.json({bill,receipt},{status:201,headers});}
 catch(e){return NextResponse.json({bill,receiptError:'The company bill was saved, but its receipt could not be attached. Use Attach receipt on this bill to try again.'},{status:201,headers});}
}catch(e){return fail(e);}}
