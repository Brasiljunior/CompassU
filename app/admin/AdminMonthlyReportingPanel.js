'use client';

import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());

export default function AdminMonthlyReportingPanel(){
  const[session,setSession]=useState(null),[institutions,setInstitutions]=useState([]),[profiles,setProfiles]=useState([]),[log,setLog]=useState([]);
  const[form,setForm]=useState({institution:'',emails:'',deliveryDay:5,timezone:'America/Chicago',active:true,analytics:true,trends:true,executive:true});
  const[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const headers=s=>({apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${s?.access_token||''}`});

  async function load(current=session){
    if(!current?.access_token)return;
    setBusy(true);setError('');
    try{
      const [i,p,l]=await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/account_institutions?select=institution&institution=not.is.null`,{headers:headers(current)}),
        fetch(`${SUPABASE_URL}/rest/v1/rpc/get_monthly_reporting_profiles`,{method:'POST',headers:headers(current),body:'{}'}),
        fetch(`${SUPABASE_URL}/rest/v1/rpc/get_monthly_report_delivery_log`,{method:'POST',headers:headers(current),body:JSON.stringify({p_limit:50})})
      ]);
      const [ir,pr,lr]=await Promise.all([i.json(),p.json(),l.json()]);
      if(!i.ok)throw new Error(ir?.message||'Unable to load institutions.');
      if(!p.ok)throw new Error(pr?.message||pr?.hint||'Monthly reporting foundation is not installed yet.');
      if(!l.ok)throw new Error(lr?.message||lr?.hint||'Unable to load monthly report delivery history.');
      setInstitutions([...new Set((ir||[]).map(x=>String(x.institution||'').trim()).filter(Boolean))].sort());
      setProfiles(pr||[]);setLog(lr||[]);
    }catch(e){setError(e.message||'Unable to load monthly reporting configuration.')}finally{setBusy(false)}
  }

  useEffect(()=>{let token='';const sync=()=>{const s=readSession();const next=s?.access_token||'';if(next===token)return;token=next;if(!next){setSession(null);setProfiles([]);setLog([]);return}setSession(s);load(s)};const refresh=()=>{const s=readSession();if(s?.access_token)load(s)};sync();const timer=setInterval(sync,700);window.addEventListener('compassu:institutions-updated',refresh);return()=>{clearInterval(timer);window.removeEventListener('compassu:institutions-updated',refresh)}},[]);

  const recipientList=useMemo(()=>form.emails.split(/[;,\n]+/).map(v=>v.trim().toLowerCase()).filter(Boolean),[form.emails]);
  function edit(profile){setForm({institution:profile.institution||'',emails:(profile.recipient_emails||[]).join(', '),deliveryDay:profile.delivery_day||5,timezone:profile.timezone||'America/Chicago',active:profile.active!==false,analytics:profile.include_institutional_analytics!==false,trends:profile.include_institutional_trends!==false,executive:profile.include_executive_insights!==false});setError('');setNotice('');}
  function clear(){setForm({institution:'',emails:'',deliveryDay:5,timezone:'America/Chicago',active:true,analytics:true,trends:true,executive:true});setError('');setNotice('')}

  async function save(){
    if(!session?.access_token||busy)return;
    if(!form.institution){setError('Select an institution.');return}
    if(form.active&&!recipientList.length){setError('Enter at least one report recipient email.');return}
    const bad=recipientList.find(v=>!validEmail(v));if(bad){setError(`Invalid recipient email: ${bad}`);return}
    if(!form.analytics&&!form.trends&&!form.executive){setError('Select at least one monthly report.');return}
    setBusy(true);setError('');setNotice('');
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_institution_monthly_reporting_profile`,{method:'POST',headers:headers(session),body:JSON.stringify({p_institution:form.institution,p_recipient_emails:recipientList,p_active:form.active,p_delivery_day:Number(form.deliveryDay)||5,p_timezone:form.timezone||'America/Chicago',p_include_institutional_analytics:form.analytics,p_include_institutional_trends:form.trends,p_include_executive_insights:form.executive})});
      const body=await r.json();if(!r.ok)throw new Error(body?.message||body?.hint||'Unable to save monthly reporting profile.');
      setNotice(`${form.institution} monthly reporting profile saved.`);await load(session);
    }catch(e){setError(e.message||'Unable to save monthly reporting profile.')}finally{setBusy(false)}
  }

  if(!session)return null;
  return <section className="analyticsPanel adminPanel"><div className="analyticsHead"><div><div className="adminKicker">STAGE 2E · AUTOMATED REPORTING</div><h2>Monthly Institutional Reporting</h2><p>Configure automatic delivery of the prior month's Institutional Analytics, Institutional Trends, and Executive Institutional Insights PDFs. Institutions receive reports by email without administrator access.</p></div><button className="btn ghost" disabled={busy} onClick={()=>load()}>{busy?'Refreshing…':'Refresh'}</button></div>
    {error&&<div className="error adminNotice">{error}</div>}{notice&&<div className="success adminNotice">{notice}</div>}
    <div className="analyticsGrid">
      <div className="analyticsCard"><h3>Reporting Profile</h3><p className="analyticsSub">Default delivery is the 5th day of each month for the previous completed calendar month.</p>
        <label>Institution</label><select value={form.institution} onChange={e=>{const name=e.target.value;const existing=profiles.find(p=>p.institution===name);existing?edit(existing):setForm({...form,institution:name})}}><option value="">Select institution</option>{institutions.map(v=><option key={v} value={v}>{v}</option>)}</select>
        <label>Report recipient email(s)</label><textarea rows="3" placeholder="president@college.edu, research@college.edu" value={form.emails} onChange={e=>setForm({...form,emails:e.target.value})}/><p className="analyticsSub">Separate multiple recipients with commas, semicolons, or new lines.</p>
        <div className="reportingFields"><label>Delivery day<input type="number" min="1" max="28" value={form.deliveryDay} onChange={e=>setForm({...form,deliveryDay:e.target.value})}/></label><label>Timezone<input value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}/></label></div>
        <label className="reportingCheck"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Monthly reporting active</label>
        <div className="reportingChecks"><label><input type="checkbox" checked={form.analytics} onChange={e=>setForm({...form,analytics:e.target.checked})}/> Institutional Analytics PDF</label><label><input type="checkbox" checked={form.trends} onChange={e=>setForm({...form,trends:e.target.checked})}/> Institutional Trends PDF</label><label><input type="checkbox" checked={form.executive} onChange={e=>setForm({...form,executive:e.target.checked})}/> Executive Institutional Insights PDF</label></div>
        <div className="adminPanelActions"><button className="btn primary" disabled={busy||!form.institution} onClick={save}>{busy?'Saving…':'Save Reporting Profile'}</button><button className="btn ghost" disabled={busy} onClick={clear}>Clear</button></div>
      </div>
      <div className="analyticsCard"><h3>Configured Institutions</h3><p className="analyticsSub">Only the CompassU Master Administrator can manage this delivery list.</p>{profiles.length?<div className="adminTableWrap"><table className="analyticsTable"><thead><tr><th>Institution</th><th>Recipients</th><th>Day</th><th>Status</th></tr></thead><tbody>{profiles.map(p=><tr key={p.id} onClick={()=>edit(p)} style={{cursor:'pointer'}}><td><b>{p.institution}</b><span>{[p.include_institutional_analytics&&'Analytics',p.include_institutional_trends&&'Trends',p.include_executive_insights&&'Executive'].filter(Boolean).join(' · ')}</span></td><td>{(p.recipient_emails||[]).join(', ')}</td><td>{p.delivery_day}</td><td><span className={`adminStatus ${p.active?'active':'suspended'}`}>{p.active?'Active':'Paused'}</span></td></tr>)}</tbody></table></div>:<div className="adminEmpty">No monthly reporting profiles configured yet.</div>}</div>
    </div>
    <div className="analyticsCard"><h3>Delivery History</h3><p className="analyticsSub">This log will record scheduled, generated, sent, failed, and skipped monthly report packages when automated delivery is enabled.</p>{log.length?<div className="adminTableWrap"><table className="analyticsTable"><thead><tr><th>Institution</th><th>Reporting Period</th><th>Recipients</th><th>Status</th><th>Sent</th></tr></thead><tbody>{log.map(r=><tr key={r.id}><td><b>{r.institution}</b></td><td>{r.reporting_period_start} through {r.reporting_period_end}</td><td>{(r.recipient_emails||[]).join(', ')}</td><td>{r.status}</td><td>{r.sent_at?new Date(r.sent_at).toLocaleString():'—'}</td></tr>)}</tbody></table></div>:<div className="adminEmpty">No automated monthly deliveries have run yet.</div>}</div>
    <div className="analyticsPrivacy">Stage 2E remains centralized: recipients receive aggregate PDF reports by email only. No institution, district, counselor, or customer administrator access is created.</div>
  </section>
}
