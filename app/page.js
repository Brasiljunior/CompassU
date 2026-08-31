'use client';

import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const baseHeaders = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
const choices = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

function getSession() {
  try { return JSON.parse(localStorage.getItem('compassu_session') || 'null'); }
  catch { return null; }
}

function authHeaders() {
  const session = getSession();
  return { ...baseHeaders, ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) };
}

async function api(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('CompassU environment variables are not configured.');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(body?.message || body?.msg || body?.error_description || body?.error || `Request failed (${response.status})`);
  return body;
}

const money = (value) => value == null ? 'Unavailable' : `$${Number(value).toLocaleString()}`;

export default function Home() {
  const [view, setView] = useState('landing');
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('signup');
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [attempt, setAttempt] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMajor, setSelectedMajor] = useState(null);
  const [careers, setCareers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [traits, setTraits] = useState([]);
  const [openCareer, setOpenCareer] = useState(null);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [favorites, setFavorites] = useState(new Set());
  const [compare, setCompare] = useState([]);

  async function signup() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST', headers: baseHeaders,
        body: JSON.stringify({ email: form.email, password: form.password, data: { first_name: form.first_name, last_name: form.last_name } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.msg || body.error_description || 'Unable to create account');
      if (body.access_token) {
        localStorage.setItem('compassu_session', JSON.stringify(body));
        setSession(body);
        await api('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: body.user.id, first_name: form.first_name, last_name: form.last_name }) });
        setView('dashboard');
      } else setMessage('Account created. Check your email to confirm your address, then log in.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function login() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: baseHeaders, body: JSON.stringify({ email: form.email, password: form.password }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error_description || body.msg || 'Login failed');
      localStorage.setItem('compassu_session', JSON.stringify(body));
      setSession(body); setView('dashboard');
      await Promise.all([loadResults(body), loadFavorites(body)]);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  function logout() {
    localStorage.removeItem('compassu_session');
    setSession(null); setView('landing'); setMatches([]); setSelectedMajor(null);
  }

  async function startAssessment() {
    setBusy(true); setNotice('');
    try {
      const qs = await api('/rest/v1/assessment_questions?is_active=eq.true&select=id,question_number,dimension,question_text&order=question_number.asc');
      setQuestions(qs);
      let rows = await api(`/rest/v1/assessment_attempts?user_id=eq.${session.user.id}&status=eq.in_progress&select=*&order=started_at.desc&limit=1`);
      let current = rows?.[0];
      if (!current) current = (await api('/rest/v1/assessment_attempts?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: session.user.id }) }))[0];
      setAttempt(current);
      const saved = await api(`/rest/v1/assessment_responses?attempt_id=eq.${current.id}&select=question_id,response_value`);
      const mapped = {}; saved.forEach((row) => { mapped[row.question_id] = Number(row.response_value.value); });
      setAnswers(mapped);
      const firstMissing = qs.findIndex((q) => !mapped[q.id]);
      setQuestionIndex(firstMissing < 0 ? 0 : firstMissing);
      setView('assessment');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function answer(value) {
    const q = questions[questionIndex];
    setAnswers({ ...answers, [q.id]: value });
    await api('/rest/v1/assessment_responses?on_conflict=attempt_id,question_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ attempt_id: attempt.id, user_id: session.user.id, question_id: q.id, response_value: { value } }),
    });
    if (questionIndex < questions.length - 1) setTimeout(() => setQuestionIndex((n) => n + 1), 160);
  }

  async function finishAssessment() {
    setBusy(true); setMessage('');
    try {
      if (Object.keys(answers).length < 80) throw new Error('Please answer all 80 questions before finishing.');
      const result = await api('/rest/v1/rpc/finalize_assessment', { method: 'POST', body: JSON.stringify({ p_attempt_id: attempt.id }) });
      setAttemptId(attempt.id); setMatches(result); setView('dashboard');
      if (result[0]) await exploreMajor(result[0], session, attempt.id);
      const delivery = await emailResults(attempt.id, true);
      if (delivery?.sent) setNotice('Your results were emailed to your account address.');
      else if (delivery?.delivery_configured === false) setNotice('Your results are ready. Automatic email delivery is prepared but the CompassU sending domain/API key still needs to be connected.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function loadResults(current = session) {
    try {
      const headers = { ...baseHeaders, Authorization: `Bearer ${current.access_token}` };
      const attempts = await fetch(`${SUPABASE_URL}/rest/v1/assessment_attempts?user_id=eq.${current.user.id}&status=eq.completed&select=id&order=completed_at.desc&limit=1`, { headers }).then((r) => r.json());
      if (!attempts?.[0]) return;
      setAttemptId(attempts[0].id);
      let rows = await fetch(`${SUPABASE_URL}/rest/v1/major_matches?attempt_id=eq.${attempts[0].id}&select=major_id,match_score,rank,majors(name)&order=rank.asc`, { headers }).then((r) => r.json());
      rows = Array.isArray(rows) && rows.length ? rows.map((r) => ({ major_id: r.major_id, major_name: r.majors?.name, match_score: r.match_score, rank: r.rank })) : await fetch(`${SUPABASE_URL}/rest/v1/rpc/finalize_assessment`, { method: 'POST', headers, body: JSON.stringify({ p_attempt_id: attempts[0].id }) }).then((r) => r.json());
      if (Array.isArray(rows)) { setMatches(rows.slice(0, 10)); if (rows[0]) await exploreMajor(rows[0], current, attempts[0].id); }
    } catch (error) { console.error(error); }
  }

  async function exploreMajor(major, current = session, currentAttemptId = attemptId) {
    setSelectedMajor(major); setBusy(true); setOpenCareer(null);
    try {
      const headers = { ...baseHeaders, Authorization: `Bearer ${current.access_token}` };
      const [careerRows, collegeRows, traitRows] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/major_occupations?major_id=eq.${major.major_id}&select=relevance_weight,occupations(id,name,soc_code,median_salary,salary_year,outlook_percent,typical_education,annual_openings,projection_start_year,projection_end_year,work_experience,on_the_job_training)&order=relevance_weight.desc&limit=12`, { headers }).then((r) => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/institution_majors?major_id=eq.${major.major_id}&select=completions_total,award_levels,source_year,institutions(id,name,city,state,website)&order=completions_total.desc.nullslast&limit=150`, { headers }).then((r) => r.json()),
        currentAttemptId ? fetch(`${SUPABASE_URL}/rest/v1/rpc/get_major_explanation`, { method: 'POST', headers, body: JSON.stringify({ p_attempt_id: currentAttemptId, p_major_id: major.major_id }) }).then((r) => r.json()) : Promise.resolve([]),
      ]);
      setCareers(Array.isArray(careerRows) ? careerRows : []); setColleges(Array.isArray(collegeRows) ? collegeRows : []); setTraits(Array.isArray(traitRows) ? traitRows : []); setStateFilter('ALL');
    } finally { setBusy(false); }
  }

  async function loadFavorites(current = session) {
    try {
      const headers = { ...baseHeaders, Authorization: `Bearer ${current.access_token}` };
      const rows = await fetch(`${SUPABASE_URL}/rest/v1/user_major_favorites?user_id=eq.${current.user.id}&select=major_id`, { headers }).then((r) => r.json());
      setFavorites(new Set((rows || []).map((r) => r.major_id)));
    } catch {}
  }

  async function toggleFavorite(id) {
    const next = new Set(favorites);
    if (favorites.has(id)) { await api(`/rest/v1/user_major_favorites?user_id=eq.${session.user.id}&major_id=eq.${id}`, { method: 'DELETE' }); next.delete(id); }
    else { await api('/rest/v1/user_major_favorites', { method: 'POST', body: JSON.stringify({ user_id: session.user.id, major_id: id }) }); next.add(id); }
    setFavorites(next);
  }

  async function emailResults(id = attemptId, silent = false) {
    if (!id) return null;
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-results-email`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ attempt_id: id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to email results');
      if (!silent) setNotice(body.sent ? 'Results email sent.' : body.message || 'Email delivery is not configured yet.');
      return body;
    } catch (error) { if (!silent) setNotice(error.message); return null; }
  }

  async function downloadPdf() {
    if (!matches.length) return;
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF();
      const firstName = session?.user?.user_metadata?.first_name || 'Student';
      pdf.setFontSize(22); pdf.text('CompassU Assessment Report', 16, 20);
      pdf.setFontSize(11); pdf.text(`Prepared for ${firstName}`, 16, 29); pdf.setTextColor(90); pdf.text('Discover Your Direction. Build Your Future.', 16, 36); pdf.setTextColor(0);
      let y = 49; pdf.setFontSize(15); pdf.text('Top Major Matches', 16, y); y += 9; pdf.setFontSize(10);
      matches.forEach((m) => { pdf.text(`#${m.rank}  ${m.major_name} — ${Number(m.match_score).toFixed(0)}% match`, 18, y); y += 7; });
      if (selectedMajor) { y += 5; pdf.setFontSize(15); pdf.text(`Why ${selectedMajor.major_name} Matches`, 16, y); y += 8; pdf.setFontSize(10); traits.slice(0, 5).forEach((t) => { pdf.text(`${t.trait_name}: ${Number(t.user_score).toFixed(0)}% alignment`, 18, y); y += 7; }); y += 4; pdf.setFontSize(15); pdf.text('Career Examples', 16, y); y += 8; pdf.setFontSize(10); careers.slice(0, 5).forEach((c) => { const o = c.occupations || {}; pdf.text(`${o.name} — ${money(o.median_salary)} median pay${o.outlook_percent != null ? `, ${o.outlook_percent}% projected growth` : ''}`, 18, y, { maxWidth: 175 }); y += 9; }); }
      pdf.setFontSize(8); pdf.setTextColor(100); pdf.text('CompassU is an educational decision-support tool. Data sources include federal CIP, BLS, and IPEDS datasets.', 16, 285); pdf.save('CompassU-Assessment-Results.pdf');
    } catch { window.print(); }
  }

  useEffect(() => {
    const stored = getSession();
    if (stored) { setSession(stored); setView('dashboard'); loadResults(stored); loadFavorites(stored); }
  }, []);

  const filteredColleges = useMemo(() => stateFilter === 'ALL' ? colleges : colleges.filter((c) => c.institutions?.state === stateFilter), [colleges, stateFilter]);
  const states = useMemo(() => [...new Set(colleges.map((c) => c.institutions?.state).filter(Boolean))].sort(), [colleges]);
  const progress = questions.length ? Math.round(((questionIndex + 1) / questions.length) * 100) : 0;

  if (view === 'landing') return <div className="shell"><Nav session={session} onLogin={() => { setView('auth'); setAuthMode('login'); }} onStart={() => { setView('auth'); setAuthMode('signup'); }} /><main className="hero"><div><span className="eyebrow">College & Career Discovery</span><h1>Discover your direction. Build your future.</h1><p>CompassU turns your interests, strengths, personality, values, and preferences into personalized college-major, career, salary, and college recommendations.</p><div className="navActions"><button className="btn primary" onClick={() => { setView('auth'); setAuthMode('signup'); }}>Start My Assessment</button><button className="btn ghost" onClick={() => { setView('auth'); setAuthMode('login'); }}>I Have an Account</button></div></div><div className="heroCard"><h2>Your CompassU Dashboard</h2><div className="mini"><b>Interactive Major Matches</b><div style={{ fontSize: 25, marginTop: 6 }}>See why each major fits you</div></div><div className="mini"><b>Career Explorer</b><div>Pay, growth, openings, and education</div></div><div className="mini"><b>College Finder</b><div>Filter schools offering your matched program</div></div></div></main><section className="features"><Feature b="80-question assessment" t="Six dimensions translated into a personal trait profile."/><Feature b="195 CIP-aligned majors" t="Recommendations tied to federal program classifications."/><Feature b="Career & salary data" t="Occupation matches with BLS labor-market information."/><Feature b="College discovery" t="IPEDS-backed program evidence across thousands of institutions."/></section></div>;

  if (view === 'auth') return <div><Nav onStart={() => setView('landing')} /><div className="center"><div className="panel"><div className="tabs"><button className={`btn ${authMode === 'signup' ? 'primary' : 'ghost'}`} onClick={() => { setAuthMode('signup'); setMessage(''); }}>Create account</button><button className={`btn ${authMode === 'login' ? 'primary' : 'ghost'}`} onClick={() => { setAuthMode('login'); setMessage(''); }}>Log in</button></div><h2>{authMode === 'signup' ? 'Create your CompassU account' : 'Welcome back'}</h2>{authMode === 'signup' && <div className="two"><Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })}/><Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })}/></div>}<Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })}/><Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })}/>{message && <div className={message.startsWith('Account created') ? 'success' : 'error'}>{message}</div>}<button className="btn primary wide" disabled={busy} onClick={authMode === 'signup' ? signup : login}>{busy ? 'Working…' : authMode === 'signup' ? 'Create account' : 'Log in'}</button></div></div></div>;

  if (view === 'assessment') {
    const q = questions[questionIndex];
    return <div><Nav session={session} onLogout={logout}/><div className="assessment"><div className="topbar"><div><b>CompassU Assessment</b><div className="muted small">{progress}% complete · answers save automatically</div></div><span className="tag">{q?.dimension?.replaceAll('_', ' ')}</span></div><div className="progressWrap"><div className="progress" style={{ width: `${progress}%` }}/></div>{q && <div className="qCard"><div className="qnum">Question {q.question_number} of 80</div><div className="question">{q.question_text}</div><div className="choices">{choices.map((label, index) => <button key={label} className={`choice ${answers[q.id] === index + 1 ? 'selected' : ''}`} onClick={() => answer(index + 1)}><b>{index + 1}</b> &nbsp; {label}</button>)}</div><div className="row"><button className="btn ghost" disabled={questionIndex === 0} onClick={() => setQuestionIndex(questionIndex - 1)}>Back</button>{questionIndex < 79 ? <button className="btn ghost" onClick={() => setQuestionIndex(questionIndex + 1)}>Next</button> : <button className="btn primary" disabled={busy} onClick={finishAssessment}>{busy ? 'Scoring…' : 'See My Results'}</button>}</div></div>}{message && <div className="error mt">{message}</div>}</div></div>;
  }

  return <div><Nav session={session} onLogout={logout}/><div className="dashboard"><div className="topbar dashboardHead"><div><h1>Your CompassU Dashboard</h1><div className="muted">Explore, compare, save, and share your personalized results.</div></div><div className="actionBar"><button className="btn ghost" disabled={!matches.length} onClick={() => emailResults()}>Email Results</button><button className="btn ghost" disabled={!matches.length} onClick={downloadPdf}>Download PDF</button><button className="btn primary" onClick={startAssessment}>{matches.length ? 'Retake Assessment' : 'Start Assessment'}</button></div></div>{notice && <div className="notice">{notice}</div>}{matches.length ? <>{compare.length > 0 && <div className="compareCard"><div className="topbar"><div><b>Compare Majors</b><div className="small muted">Select up to 3 majors.</div></div><button className="btn tiny ghost" onClick={() => setCompare([])}>Clear</button></div><div className="compareGrid">{compare.map((m) => <div className="compareItem" key={m.major_id}><span className="score">{Number(m.match_score).toFixed(0)}%</span><b>{m.major_name}</b><button className="textBtn" onClick={() => exploreMajor(m)}>Explore</button></div>)}</div></div>}<div className="grid"><div className="card"><div className="sectionTitle">Your Top Major Matches</div>{matches.map((m) => <div className={`match ${selectedMajor?.major_id === m.major_id ? 'activeMatch' : ''}`} key={m.major_id}><button className="matchMain" onClick={() => exploreMajor(m)}><div className="rank">{m.rank}</div><div><b>{m.major_name}</b><div className="muted small">Explore why it matches, careers, and colleges</div></div><div className="score">{Number(m.match_score).toFixed(0)}%</div></button><div className="matchTools"><button title="Save favorite" className={`iconBtn ${favorites.has(m.major_id) ? 'saved' : ''}`} onClick={() => toggleFavorite(m.major_id)}>{favorites.has(m.major_id) ? '★' : '☆'}</button><button className={`chip ${compare.some((x) => x.major_id === m.major_id) ? 'chipOn' : ''}`} onClick={() => setCompare((items) => items.some((x) => x.major_id === m.major_id) ? items.filter((x) => x.major_id !== m.major_id) : items.length < 3 ? [...items, m] : items)}>Compare</button></div></div>)}</div><div className="detailStack">{selectedMajor && <div className="card"><div className="sectionTitle">Why This Major Matches You</div><h2 className="majorTitle">{selectedMajor.major_name} <span>{Number(selectedMajor.match_score).toFixed(0)}%</span></h2><p className="muted small">Your score is based on the traits most important to this field—not just a broad career category.</p><div className="traitList">{traits.slice(0, 6).map((t) => <div className="trait" key={t.trait_code}><div className="topbar"><b>{t.trait_name}</b><span>{Number(t.user_score).toFixed(0)}%</span></div><div className="traitTrack"><div style={{ width: `${Math.min(100, Number(t.user_score))}%` }}/></div></div>)}</div></div>}<div className="card"><div className="sectionTitle">Career Explorer</div>{careers.length === 0 ? <div className="muted">The federal CIP→SOC crosswalk does not provide a direct occupation for this program. CompassU will not fabricate a career link.</div> : careers.slice(0, 8).map((row) => { const o = row.occupations || {}; const open = openCareer === o.id; return <button className="career interactiveRow" key={o.id} onClick={() => setOpenCareer(open ? null : o.id)}><div className="topbar"><div><b>{o.name}</b><div className="small muted">{money(o.median_salary)} median pay{o.outlook_percent != null ? ` · ${o.outlook_percent}% projected growth` : ''}</div></div><span>{open ? '−' : '+'}</span></div>{open && <div className="careerDetail"><Metric l="Typical education" v={o.typical_education || 'Unavailable'}/><Metric l="Annual openings" v={o.annual_openings != null ? Number(o.annual_openings).toLocaleString() : 'Unavailable'}/><Metric l="Projection period" v={o.projection_start_year && o.projection_end_year ? `${o.projection_start_year}–${o.projection_end_year}` : 'Unavailable'}/><Metric l="On-the-job training" v={o.on_the_job_training || 'Unavailable'}/></div>}</button>; })}</div><div className="card"><div className="topbar"><div className="sectionTitle noMargin">College Finder</div><select className="select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}><option value="ALL">All states</option>{states.map((s) => <option key={s}>{s}</option>)}</select></div><div className="small muted mb">IPEDS evidence shows institutions that recently awarded credentials in the selected CIP program.</div>{filteredColleges.slice(0, 12).map((row) => <div className="college" key={row.institutions?.id}><div><b>{row.institutions?.name}</b><div className="small muted">{[row.institutions?.city, row.institutions?.state].filter(Boolean).join(', ')}</div></div><div className="small collegeMeta">{row.completions_total != null ? <><b>{Number(row.completions_total).toLocaleString()}</b><span>2024 completions</span></> : <span>Program evidence</span>}</div></div>)}{filteredColleges.length > 12 && <div className="muted small more">Showing 12 of {filteredColleges.length} matches in this view.</div>}</div></div></div></> : <div className="panel"><h2>Ready to discover your direction?</h2><p className="muted">Complete the 80-question assessment to unlock personalized major, career, salary, and college recommendations.</p><button className="btn primary" onClick={startAssessment}>Begin Assessment</button></div>}</div></div>;
}

function Nav({ session, onLogin, onStart, onLogout }) { return <nav className="nav"><button onClick={onStart} className="brand brandBtn">Compass<span>U</span></button><div className="navActions">{session ? <button className="btn ghost" onClick={onLogout}>Log out</button> : <><button className="btn ghost" onClick={onLogin}>Log in</button><button className="btn primary" onClick={onStart}>Get Started</button></>}</div></nav>; }
function Field({ label, type = 'text', value, onChange }) { return <div className="field"><label>{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)}/></div>; }
function Feature({ b, t }) { return <div className="feature"><b>{b}</b><span className="muted">{t}</span></div>; }
function Metric({ l, v }) { return <div className="metric"><span>{l}</span><b>{v}</b></div>; }
