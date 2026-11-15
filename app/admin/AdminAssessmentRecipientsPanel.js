'use client';
import {useEffect,useState} from 'react';
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export default function AdminAssessmentRecipientsPanel(){
 const [institutions,setInstitutions]=useState([]);
 const [records,setRecords]=useState([]);
 const [authorizations,setAuthorizations]=useState([]);
 const [authorizationReference,setAuthorizationReference]=useState('');
 const [institution,setInstitution]=useState('');
 const [email,setEmail]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const session=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
 const headers=()=>({apikey:KEY,Authorization:`Bearer ${session()?.access_token||''}`,'Content-Type':'application/json'});
 async function rpc(name,body={}){
  const response=await fetch(`${URL}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(),body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(data?.message||data?.error||'Unable to access assessment recipient settings');
  return data;
 }
 async function load(){
  if(!session()?.access_token)return;
  try{
   const [assigned,recipients,approvals]=await Promise.all([
    fetch(`${URL}/rest/v1/account_institutions?select=institution&institution=not.is.null`,{headers:headers()}).then(async r=>{if(!r.ok)throw Error('Unable to load home institutions');return r.json()}),
    rpc('get_institution_assessment_recipients'),
    rpc('get_institution_assessment_delivery_authorizations')
   ]);
   setInstitutions([...new Set(assigned.map(r=>r.institution?.trim()).filter(Boolean))].sort());
   setRecords(Array.isArray(recipients)?recipients:[]);
   setAuthorizations(Array.isArray(approvals)?approvals:[]);
   setMessage('');
  }catch(e){setMessage(e.message)}
 }
 useEffect(()=>{load();},[]);
 async function save(){
  const address=email.trim().toLowerCase();
  if(!institution||!validEmail(address)){setMessage('Select an institution and enter a valid email address.');return;}
  setBusy(true);
  try{await rpc('set_institution_assessment_recipient',{p_institution:institution,p_email:address,p_active:true});setEmail('');await load();setMessage('Assessment recipient saved. Automatic delivery will begin only when the delivery feature is enabled.')}
  catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 async function configureAuthorization(approved){
  if(!institution){setMessage('Select an institution first.');return;}
  if(approved&&!authorizationReference.trim()){setMessage('Enter the institutional authorization reference before enabling delivery.');return;}
  setBusy(true);
  try{
   await rpc('set_institution_assessment_delivery_authorization',{p_institution:institution,p_approved:approved,p_authorization_reference:approved?authorizationReference.trim():null});
   await load();
   setMessage(approved?'Institutional assessment delivery authorized for future assessment completions.':'Institutional assessment delivery disabled.');
  }catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 async function remove(record){
  if(!window.confirm(`Remove ${record.email} from ${record.institution} assessment recipients?`))return;
  setBusy(true);
  try{await rpc('set_institution_assessment_recipient',{p_institution:record.institution,p_email:record.email,p_active:false});await load();setMessage('Recipient removed.')}
  catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 return <section style={{maxWidth:1320,margin:'32px auto',padding:24,background:'white',borderRadius:20,border:'1px solid #e3e8f2'}}>
  <h2>Institutional Assessment Email Recipients</h2>
  <p>Assign an institution-provided email address to a student's home institution. These settings are separate from monthly reports.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
   <label>Home institution<br/><select value={institution} onChange={e=>setInstitution(e.target.value)} style={{padding:10,minWidth:240}}><option value=''>Select institution</option>{institutions.map(name=><option key={name}>{name}</option>)}</select></label>
   <label>Institutional representative email<br/><input type='email' value={email} onChange={e=>setEmail(e.target.value)} placeholder='representative@college.edu' style={{padding:10,minWidth:260}}/></label>
   <button disabled={busy} onClick={save} style={{padding:12,background:'#2f6fed',color:'white',borderRadius:8}}>Save Recipient</button>
  </div>
  <div style={{marginTop:20,padding:16,border:'1px solid #e3e8f2',borderRadius:10}}>
   <h3>Automatic assessment email delivery</h3>
   <p>Institutional delivery status for the selected institution: <strong>{authorizations.find(a=>a.institution_name.toLowerCase()===institution.toLowerCase())?.approved?'Authorized':'Not authorized'}</strong>. Authorization applies to assessments completed after approval.</p>
   <label>Institutional authorization reference<br/><input value={authorizationReference} onChange={e=>setAuthorizationReference(e.target.value)} placeholder='Agreement or authorization reference' style={{padding:10,minWidth:300}}/></label>
   <div style={{display:'flex',gap:10,marginTop:12}}>
    <button disabled={busy||!institution} onClick={()=>configureAuthorization(true)}>Enable automatic delivery</button>
    <button disabled={busy||!institution} onClick={()=>configureAuthorization(false)}>Disable delivery</button>
   </div>
  </div>
  {message&&<p role='status'>{message}</p>}
  <h3>Saved recipients</h3>
  {records.length===0?<p>No assessment recipients configured.</p>:<ul>{records.map(record=><li key={record.institution+'|'+record.email}>{record.institution}: {record.email} <button disabled={busy} onClick={()=>remove(record)}>Remove</button></li>)}</ul>}
 </section>;
}
