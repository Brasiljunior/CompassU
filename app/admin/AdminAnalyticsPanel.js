'use client';

import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const labelize=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function AdminAnalyticsPanel(){
  const[session,setSession]=useState(null),[analytics,setAnalytics]=useState(null),[institutions,setInstitutions]=useState([]),[institution,setInstitution]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');

  const headers=current=>({apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${current?.access_token||''}`});

  async function loadInstitutions(current){
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/account_institutions?select=institution&institution=not.is.null`,{headers:headers(current)});
      const rows=await r.json();
      if(!r.ok)throw new Error(rows?.message||rows?.error||'Unable to load institutions');
      setInstitutions([...new Set((rows||[]).map(x=>String(x.institution||'').trim()).filter(Boolean))].sort());
    }catch(e){console.warn('Institution list unavailable',e)}
  }

  async function loadAnalytics(current=session,nextInstitution=institution){
    if(!current?.access_token)return;
    setBusy(true);setError('');
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_institutional_analytics`,{method:'POST',headers:headers(current),body:JSON.stringify({p_institution:nextInstitution||null})});
      const body=await r.json();
      if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||'Unable to load institutional analytics');
      setAnalytics(body);
    }catch(e){setAnalytics(null);setError(e.message)}finally{setBusy(false)}
  }

  useEffect(()=>{
    let activeToken='';
    const syncSession=()=>{
      const s=readSession();
      const token=s?.access_token||'';
      if(token===activeToken)return;
      activeToken=token;
      if(!token){setSession(null);setAnalytics(null);return;}
      setSession(s);
      loadInstitutions(s);
      loadAnalytics(s,'');
    };
    syncSession();
    const timer=setInterval(syncSession,500);
    const onStorage=e=>{if(e.key==='compassu_session')syncSession()};
    window.addEventListener('storage',onStorage);
    return()=>{clearInterval(timer);window.removeEventListener('storage',onStorage)};
  },[]);

  const p=analytics?.participation||{};
  const dimensions=(analytics?.dimensions||[]).filter(x=>!x.suppressed);
  const clusters=(analytics?.career_clusters||[]).filter(x=>!x.suppressed);
  const majors=(analytics?.top_majors||[]).filter(x=>!x.suppressed);
  const careers=(analytics?.top_careers||[]).filter(x=>!x.suppressed);
  const maxCluster=useMemo(()=>Math.max(1,...clusters.map(x=>x.student_count||0)),[clusters]);

  if(!session)return null;

  return <section className="analyticsPanel adminPanel">
    <div className="analyticsHead">
      <div><div className="adminKicker">INSTITUTIONAL INTELLIGENCE</div><h2>Institutional Analytics</h2><p>Aggregate participation, student profile, career-cluster, major, and career insights based on each student's latest completed CompassU assessment.</p></div>
      <div className="analyticsControls"><select value={institution} onChange={e=>{const v=e.target.value;setInstitution(v);loadAnalytics(session,v)}}><option value="">All Institutions</option>{institutions.map(v=><option key={v} value={v}>{v}</option>)}</select><button className="btn primary" disabled={busy} onClick={()=>loadAnalytics()}>{busy?'Refreshing…':'Refresh Analytics'}</button></div>
    </div>
    {busy&&!analytics&&<div className="analyticsLoading">Loading institutional analytics…</div>}
    {error&&<div className="error adminNotice">{error}</div>}
    {analytics&&<>
      <div className="analyticsStats"><Metric label="Assigned accounts" value={p.assigned_accounts??0}/><Metric label="Students started" value={p.started_students??0}/><Metric label="Students completed" value={p.completed_students??0}/><Metric label="Completion rate" value={`${p.completion_rate??0}%`}/><Metric label="Not completed" value={p.not_completed_students??0}/></div>
      <div className="analyticsGrid">
        <div className="analyticsCard"><h3>Student Profile — Six Dimensions</h3><p className="analyticsSub">Average normalized score across students with completed assessments.</p><div className="dimensionList">{dimensions.map(d=><div className="dimensionRow" key={d.dimension}><div><b>{labelize(d.dimension)}</b><span>{d.student_count} students</span></div><strong>{d.average_score}%</strong></div>)}{!dimensions.length&&<div className="adminEmpty">No reportable dimension data yet.</div>}</div></div>
        <div className="analyticsCard"><h3>Top Career Clusters</h3><p className="analyticsSub">Dominant aggregate cluster by student. Categories under the privacy threshold are suppressed.</p><div className="clusterList">{clusters.map(c=><div className="clusterRow" key={c.cluster}><div className="clusterTop"><b>{labelize(c.cluster)}</b><span>{c.student_count}</span></div><div className="clusterTrack"><i style={{width:`${Math.max(4,Math.round((c.student_count/maxCluster)*100))}%`}}/></div></div>)}{!clusters.length&&<div className="adminEmpty">No reportable cluster cells yet.</div>}</div></div>
        <div className="analyticsCard"><h3>Top Recommended Majors</h3><p className="analyticsSub">Counts how often a major appears anywhere in students' Top 10 CompassU recommendations.</p><table className="analyticsTable"><thead><tr><th>Major</th><th>Students</th><th>Avg. Match</th></tr></thead><tbody>{majors.slice(0,10).map(m=><tr key={m.major_id}><td><b>{m.major_name}</b>{m.career_cluster&&<span>{labelize(m.career_cluster)}</span>}</td><td>{m.student_count}</td><td>{m.average_match_score==null?'—':`${m.average_match_score}%`}</td></tr>)}</tbody></table>{!majors.length&&<div className="adminEmpty">No major reaches the current privacy reporting threshold yet.</div>}</div>
        <div className="analyticsCard"><h3>Top Career Alignments</h3><p className="analyticsSub">Recurring careers connected to students' Top 3 recommended majors.</p><table className="analyticsTable"><thead><tr><th>Career</th><th>Students</th></tr></thead><tbody>{careers.slice(0,10).map(c=><tr key={c.occupation_id}><td><b>{c.occupation_name}</b>{c.soc_code&&<span>SOC {c.soc_code}</span>}</td><td>{c.student_count}</td></tr>)}</tbody></table>{!careers.length&&<div className="adminEmpty">No career reaches the current privacy reporting threshold yet.</div>}</div>
      </div>
      <div className="analyticsPrivacy">Privacy safeguard: categories representing fewer than {analytics?.privacy?.small_cell_threshold??5} students are suppressed. Analytics use each student's latest completed assessment only.</div>
    </>}
  </section>
}

function Metric({label,value}){return <div className="analyticsMetric"><span>{label}</span><strong>{value}</strong></div>}
