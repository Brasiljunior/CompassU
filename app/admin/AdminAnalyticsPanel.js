'use client';

import { useEffect, useMemo, useState } from 'react';
import { exportInstitutionalAnalyticsPdf } from './institutionalAnalyticsPdf';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const labelize=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const pct=v=>v==null?'—':`${v}%`;

export default function AdminAnalyticsPanel(){
  const[session,setSession]=useState(null),[analytics,setAnalytics]=useState(null),[institutions,setInstitutions]=useState([]),[institution,setInstitution]=useState('');
  const[draftStartDate,setDraftStartDate]=useState(''),[draftEndDate,setDraftEndDate]=useState(''),[appliedStartDate,setAppliedStartDate]=useState(''),[appliedEndDate,setAppliedEndDate]=useState('');
  const[busy,setBusy]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState('');
  const[comparisonSelection,setComparisonSelection]=useState([]),[comparison,setComparison]=useState(null),[compareBusy,setCompareBusy]=useState(false),[compareError,setCompareError]=useState('');
  const headers=current=>({apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${current?.access_token||''}`});

  async function loadInstitutions(current){
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/account_institutions?select=institution&institution=not.is.null`,{headers:headers(current)});
      const rows=await r.json();if(!r.ok)throw new Error(rows?.message||rows?.error||'Unable to load institutions');
      const names=[...new Set((rows||[]).map(x=>String(x.institution||'').trim()).filter(Boolean))].sort();setInstitutions(names);
      setComparisonSelection(prev=>prev.length?prev:names.slice(0,Math.min(2,names.length)));
    }catch(e){console.warn('Institution list unavailable',e)}
  }

  async function loadAnalytics(current=session,nextInstitution=institution,nextStart=appliedStartDate,nextEnd=appliedEndDate){
    if(!current?.access_token)return;
    if(nextStart&&nextEnd&&nextStart>nextEnd){setError('Start date cannot be after end date.');return}
    setBusy(true);setError('');
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_institutional_analytics_v2`,{method:'POST',headers:headers(current),body:JSON.stringify({p_institution:nextInstitution||null,p_start_date:nextStart||null,p_end_date:nextEnd||null})});
      const body=await r.json();if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||'Unable to load institutional analytics');setAnalytics(body);
    }catch(e){setAnalytics(null);setError(e.message)}finally{setBusy(false)}
  }

  function applyPeriod(){
    if(draftStartDate&&draftEndDate&&draftStartDate>draftEndDate){setError('Start date cannot be after end date.');return}
    setAppliedStartDate(draftStartDate);setAppliedEndDate(draftEndDate);loadAnalytics(session,institution,draftStartDate,draftEndDate);setComparison(null);
  }
  function clearPeriod(){setDraftStartDate('');setDraftEndDate('');setAppliedStartDate('');setAppliedEndDate('');loadAnalytics(session,institution,'','');setComparison(null)}
  async function exportReport(){if(!analytics||exporting)return;setExporting(true);setError('');try{await exportInstitutionalAnalyticsPdf({analytics,institution,startDate:appliedStartDate,endDate:appliedEndDate})}catch(e){setError(e?.message||'Unable to generate the institutional analytics report.')}finally{setExporting(false)}}

  function toggleComparisonInstitution(name){setComparisonSelection(prev=>prev.includes(name)?prev.filter(v=>v!==name):[...prev,name])}
  async function loadComparison(){
    if(!session?.access_token)return;
    if(comparisonSelection.length<2){setCompareError('Select at least two institutions to compare.');return}
    setCompareBusy(true);setCompareError('');
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_institutional_comparison`,{method:'POST',headers:headers(session),body:JSON.stringify({p_institutions:comparisonSelection,p_start_date:appliedStartDate||null,p_end_date:appliedEndDate||null})});
      const body=await r.json();if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||'Unable to load institutional comparison');setComparison(body);
    }catch(e){setComparison(null);setCompareError(e.message)}finally{setCompareBusy(false)}
  }

  useEffect(()=>{let activeToken='';const syncSession=()=>{const s=readSession();const token=s?.access_token||'';if(token===activeToken)return;activeToken=token;if(!token){setSession(null);setAnalytics(null);setComparison(null);return}setSession(s);loadInstitutions(s);loadAnalytics(s,'','','')};syncSession();const timer=setInterval(syncSession,500);const onStorage=e=>{if(e.key==='compassu_session')syncSession()};window.addEventListener('storage',onStorage);return()=>{clearInterval(timer);window.removeEventListener('storage',onStorage)}},[]);

  const p=analytics?.participation||{};const filtered=Boolean(analytics?.reporting_period?.filtered);
  const dimensions=(analytics?.dimensions||[]).filter(x=>!x.suppressed);const clusters=(analytics?.career_clusters||[]).filter(x=>!x.suppressed);const majors=(analytics?.top_majors||[]).filter(x=>!x.suppressed);const careers=(analytics?.top_careers||[]).filter(x=>!x.suppressed);const maxCluster=useMemo(()=>Math.max(1,...clusters.map(x=>x.student_count||0)),[clusters]);
  if(!session)return null;

  return <section className="analyticsPanel adminPanel"><div className="analyticsHead"><div><div className="adminKicker">INSTITUTIONAL INTELLIGENCE</div><h2>Institutional Analytics</h2><p>Aggregate participation, student profile, career-cluster, major, and career insights based on each student's latest completed CompassU assessment.</p></div><div className="analyticsControls">
    <select value={institution} onChange={e=>{const v=e.target.value;setInstitution(v);loadAnalytics(session,v,appliedStartDate,appliedEndDate)}}><option value="">All Institutions</option>{institutions.map(v=><option key={v} value={v}>{v}</option>)}</select>
    <label className="analyticsDate"><span>From</span><input type="date" value={draftStartDate} max={draftEndDate||undefined} onChange={e=>setDraftStartDate(e.target.value)}/></label>
    <label className="analyticsDate"><span>Through</span><input type="date" value={draftEndDate} min={draftStartDate||undefined} onChange={e=>setDraftEndDate(e.target.value)}/></label>
    <button className="btn ghost" disabled={busy} onClick={applyPeriod}>{busy?'Applying…':'Apply Period'}</button>
    {(draftStartDate||draftEndDate||appliedStartDate||appliedEndDate)&&<button className="btn ghost" disabled={busy} onClick={clearPeriod}>Clear Period</button>}
    <button className="btn ghost" disabled={!analytics||busy||exporting} onClick={exportReport}>{exporting?'Generating PDF…':'Export Analytics PDF'}</button>
    <button className="btn primary" disabled={busy} onClick={()=>loadAnalytics()}>{busy?'Refreshing…':'Refresh Analytics'}</button>
  </div></div>
  {filtered&&<div className="analyticsPeriod">Reporting period: <b>{analytics.reporting_period.start_date||'Beginning of records'}</b> through <b>{analytics.reporting_period.end_date||'Present'}</b>. Assessment metrics reflect activity within this period.</div>}
  {busy&&!analytics&&<div className="analyticsLoading">Loading institutional analytics…</div>}{error&&<div className="error adminNotice">{error}</div>}
  {analytics&&<><div className="analyticsStats"><Metric label="Assigned accounts" value={p.assigned_accounts??0}/><Metric label={filtered?'Started in Period':'Students started'} value={p.started_students??0}/><Metric label={filtered?'Completed in Period':'Students completed'} value={p.completed_students??0}/><Metric label={filtered?'Completion in Period':'Completion rate'} value={`${p.completion_rate??0}%`}/><Metric label="Not completed" value={p.not_completed_students??0}/></div><div className="analyticsGrid">
    <div className="analyticsCard"><h3>Student Profile — Six Dimensions</h3><p className="analyticsSub">Average normalized score across students with completed assessments.</p><div className="dimensionList">{dimensions.map(d=><div className="dimensionRow" key={d.dimension}><div><b>{labelize(d.dimension)}</b><span>{d.student_count} students</span></div><strong>{d.average_score}%</strong></div>)}{!dimensions.length&&<div className="adminEmpty">No reportable dimension data yet.</div>}</div></div>
    <div className="analyticsCard"><h3>Top Career Clusters</h3><p className="analyticsSub">Dominant aggregate cluster by student. Categories under the privacy threshold are suppressed.</p><div className="clusterList">{clusters.map(c=><div className="clusterRow" key={c.cluster}><div className="clusterTop"><b>{labelize(c.cluster)}</b><span>{c.student_count}</span></div><div className="clusterTrack"><i style={{width:`${Math.max(4,Math.round((c.student_count/maxCluster)*100))}%`}}/></div></div>)}{!clusters.length&&<div className="adminEmpty">No reportable cluster cells yet.</div>}</div></div>
    <div className="analyticsCard"><h3>Top Recommended Majors</h3><p className="analyticsSub">Counts how often a major appears anywhere in students' Top 10 CompassU recommendations.</p><table className="analyticsTable"><thead><tr><th>Major</th><th>Students</th><th>Avg. Match</th></tr></thead><tbody>{majors.slice(0,10).map(m=><tr key={m.major_id}><td><b>{m.major_name}</b>{m.career_cluster&&<span>{labelize(m.career_cluster)}</span>}</td><td>{m.student_count}</td><td>{m.average_match_score==null?'—':`${m.average_match_score}%`}</td></tr>)}</tbody></table>{!majors.length&&<div className="adminEmpty">No major reaches the current privacy reporting threshold yet.</div>}</div>
    <div className="analyticsCard"><h3>Top Career Alignments</h3><p className="analyticsSub">Recurring careers connected to students' Top 3 recommended majors.</p><table className="analyticsTable"><thead><tr><th>Career</th><th>Students</th></tr></thead><tbody>{careers.slice(0,10).map(c=><tr key={c.occupation_id}><td><b>{c.occupation_name}</b>{c.soc_code&&<span>SOC {c.soc_code}</span>}</td><td>{c.student_count}</td></tr>)}</tbody></table>{!careers.length&&<div className="adminEmpty">No career reaches the current privacy reporting threshold yet.</div>}</div>
  </div><div className="analyticsPrivacy">Privacy safeguard: categories representing fewer than {analytics?.privacy?.small_cell_threshold??5} students are suppressed. Reporting-period filtering is applied to assessment activity before aggregate results are displayed.</div></>}

  <div className="comparisonSection"><div className="comparisonHead"><div><div className="adminKicker">STAGE 2B</div><h2>Compare Institutions</h2><p>Compare participating institutions side-by-side using the same privacy safeguards and reporting period shown above.</p></div><button className="btn primary" disabled={compareBusy||comparisonSelection.length<2} onClick={loadComparison}>{compareBusy?'Comparing…':'Compare Selected'}</button></div>
    <div className="comparisonPicker">{institutions.map(name=><label key={name} className={comparisonSelection.includes(name)?'selected':''}><input type="checkbox" checked={comparisonSelection.includes(name)} onChange={()=>toggleComparisonInstitution(name)}/><span>{name}</span></label>)}{!institutions.length&&<div className="adminEmpty">No institutions are available for comparison.</div>}</div>
    <div className="comparisonMeta">{comparisonSelection.length} selected{(appliedStartDate||appliedEndDate)&&<> · Reporting period {appliedStartDate||'Beginning of records'} through {appliedEndDate||'Present'}</>}</div>
    {compareError&&<div className="error adminNotice">{compareError}</div>}
    {comparison?.institutions?.length>0&&<ComparisonResults rows={comparison.institutions}/>} 
  </div>
  </section>
}

function Metric({label,value}){return <div className="analyticsMetric"><span>{label}</span><strong>{value}</strong></div>}

function ComparisonResults({rows}){
  const dimensions=[...new Set(rows.flatMap(r=>(r.dimensions||[]).filter(x=>!x.suppressed).map(x=>x.dimension)))];
  return <div className="comparisonResults">
    <div className="comparisonTableWrap"><table className="comparisonTable"><thead><tr><th>Metric</th>{rows.map(r=><th key={r.institution}>{r.institution}</th>)}</tr></thead><tbody>
      <tr><td>Assigned accounts</td>{rows.map(r=><td key={r.institution}>{r.participation?.assigned_accounts??0}</td>)}</tr>
      <tr><td>Students started</td>{rows.map(r=><td key={r.institution}>{r.participation?.started_students??0}</td>)}</tr>
      <tr><td>Students completed</td>{rows.map(r=><td key={r.institution}>{r.participation?.completed_students??0}</td>)}</tr>
      <tr><td>Completion rate</td>{rows.map(r=><td key={r.institution}><b>{pct(r.participation?.completion_rate)}</b></td>)}</tr>
    </tbody></table></div>

    <div className="comparisonGrid">
      <div className="analyticsCard"><h3>Six-Dimension Comparison</h3><p className="analyticsSub">Average normalized scores. Suppressed cells are shown as unavailable.</p><div className="comparisonTableWrap"><table className="comparisonTable compact"><thead><tr><th>Dimension</th>{rows.map(r=><th key={r.institution}>{r.institution}</th>)}</tr></thead><tbody>{dimensions.map(d=><tr key={d}><td>{labelize(d)}</td>{rows.map(r=>{const item=(r.dimensions||[]).find(x=>x.dimension===d);return <td key={r.institution}>{item&&!item.suppressed?pct(item.average_score):'—'}</td>})}</tr>)}</tbody></table></div></div>
      <div className="analyticsCard"><h3>Leading Career Clusters</h3><p className="analyticsSub">Top reportable clusters for each institution.</p><div className="comparisonCards">{rows.map(r=><div key={r.institution}><b>{r.institution}</b>{(r.career_clusters||[]).filter(x=>!x.suppressed).slice(0,3).map(c=><span key={c.cluster}>{labelize(c.cluster)} · {c.student_count}</span>)}{!(r.career_clusters||[]).some(x=>!x.suppressed)&&<span>No reportable cluster cells</span>}</div>)}</div></div>
      <div className="analyticsCard"><h3>Recurring Major Alignments</h3><p className="analyticsSub">Top reportable majors appearing in students' CompassU recommendations.</p><div className="comparisonCards">{rows.map(r=><div key={r.institution}><b>{r.institution}</b>{(r.top_majors||[]).filter(x=>!x.suppressed).slice(0,5).map(m=><span key={m.major_id}>{m.major_name} · {m.student_count}</span>)}{!(r.top_majors||[]).some(x=>!x.suppressed)&&<span>No reportable major cells</span>}</div>)}</div></div>
      <div className="analyticsCard"><h3>Recurring Career Alignments</h3><p className="analyticsSub">Top reportable careers connected to students' leading major recommendations.</p><div className="comparisonCards">{rows.map(r=><div key={r.institution}><b>{r.institution}</b>{(r.top_careers||[]).filter(x=>!x.suppressed).slice(0,5).map(c=><span key={c.occupation_id}>{c.occupation_name} · {c.student_count}</span>)}{!(r.top_careers||[]).some(x=>!x.suppressed)&&<span>No reportable career cells</span>}</div>)}</div></div>
    </div>
  </div>
}
