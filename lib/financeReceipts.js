import {createClient} from '@supabase/supabase-js';
import {FinanceError,db} from './financeServer.js';
import {randomUUID} from 'node:crypto';
const bucket='finance-receipts';
function storage(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)throw new FinanceError('Receipt storage is not configured.',503);return createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from(bucket);}
const uuid=v=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v)))throw new FinanceError('Invalid company bill identifier.');return v;};
export async function attachReceipt(expenseId,file,actor){
 uuid(expenseId);
 const bills=await db(`finance_expenses?id=eq.${expenseId}&select=id&limit=1`);if(!bills.length)throw new FinanceError('Company bill not found.',404);
 const existing=await db(`finance_expense_receipts?expense_id=eq.${expenseId}&select=id&limit=1`);if(existing.length)throw new FinanceError('This company bill already has a receipt.',409);
 const path=expenseId+'/'+randomUUID()+'.'+file.extension,s=storage();
 const {error}=await s.upload(path,file.buffer,{contentType:file.mime,upsert:false});if(error)throw new FinanceError('Receipt upload failed. Please try attaching the receipt again.',502);
 try{return await db('rpc/finance_register_receipt',{method:'POST',body:JSON.stringify({p_expense:expenseId,p_path:path,p_name:file.name,p_type:file.mime,p_size:file.size,p_actor:actor})});}
 catch(e){
  // A lost database response may still have committed the receipt. Confirm before cleanup.
  let saved;try{saved=await db(`finance_expense_receipts?expense_id=eq.${expenseId}&select=*&limit=1`);}catch{console.error('Receipt outcome could not be confirmed',expenseId);throw e;}
  if(saved[0]?.object_path===path)return saved[0];
  const {error:cleanup}=await s.remove([path]);if(cleanup)console.error('Receipt cleanup failed',expenseId);throw e;
 }

}
export async function downloadReceipt(expenseId){
 uuid(expenseId);const rows=await db(`finance_expense_receipts?expense_id=eq.${expenseId}&select=object_path,file_name,content_type&limit=1`);if(!rows.length)throw new FinanceError('No receipt is attached to this bill.',404);
 const r=rows[0];if(!r.object_path.startsWith(expenseId+'/')||r.object_path.includes('..'))throw new FinanceError('Invalid receipt record.',500);
 const {data,error}=await storage().download(r.object_path);if(error)throw new FinanceError('The receipt could not be downloaded. Please try again.',502);
 return {buffer:Buffer.from(await data.arrayBuffer()),name:r.file_name,type:r.content_type};
}
