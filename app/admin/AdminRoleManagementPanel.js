'use client';

import {useEffect,useMemo,useState} from 'react';

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const readSession=()=>{try{return JSON.parse(localStorage.getItem('compassu_session')||'null')}catch{return null}};
const roleLabel={master_admin:'Master Administrator',system_admin:'System / District Administrator',institution_admin:'Institution Administrator',counselor:'Counselor / Advisor'};

async function request(path,session,body){
  const r=await fetch(`${SUPABASE_URL}${path}`,{method:body?'POST':'GET',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const payload=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(payload?.message||payload?.error_description||payload?.hint||payload?.details||'Stage 3 administrator request failed.');
  return payload;
}

export default function AdminRoleManagementPanel(){
  const[session,setSession]=useState(null),[context,setContext]=useState([]),[organizations,setOrganizations]=useState([]),[institutions,setInstitutions]=useState([]),[assignments,setAssignments]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const[form,setForm]=useState({email:'',role:'institution_admin',organization_id:'',tenant_institution_id:''});

  const isMaster=context.some(c=>c.role==='master_admin');
  const systemOrgIds=useMemo(()=>new Set(context.filter(c=>c.role==='system_admin').map(c=>c.organization_id)),[context]);
  const institutionAdminIds=useMemo(()=>new Set(context.filter(c=>c.role==='institution_admin').map(c=>c.tenant_institution_id)),[context]);
  const canManage=context.some(c=>['master_admin','system_admin','institution_admin'].includes(c.role));

  const availableRoles=useMemo(()=>{
    if(isMaster)return['system_admin','institution_admin','counselor'];
    if(systemOrgIds.size)return['institution_admin','counselor'];
    if(institutionAdminIds.size)return['counselor'];
    return[];
  },[isMaster,systemOrgIds,institutionAdminIds]);

  const filteredOrganizations=useMemo(()=>{
    if(isMaster)return organizations;
    return organizations.filter(o=>systemOrgIds.has(o.id)||institutions.some(i=>i.organization_id===o.id&&institutionAdminIds.has(i.id)));
  },[organizations,institutions,isMaster,systemOrgIds,institutionAdminIds]);

  const filteredInstitutions=useMemo(()=>{
    let rows=institutions;
    if(form.organization_id)rows=rows.filter(i=>i.organization_id===form.organization_id);
    if(!isMaster&&form.role==='institution_admin')rows=rows.filter(i=>systemOrgIds.has(i.organization_id));
    if(!isMaster&&form.role==='counselor')rows=rows.filter(i=>systemOrgIds.has(i.organization_id)||institutionAdminIds.has(i.id));
    return rows;
  },[institutions,form.organization_id,form.role,isMaster,systemOrgIds,institutionAdminIds]);

  async function load(current=readSession()){
    if(!current?.access_token){setSession(null);setContext([]);return}
    setSession(current);setBusy(true);setError('');
    try{
      const [ctx,orgs,insts,roles]=await Promise.all([
        request('/rest/v1/rpc/get_compassu_admin_context',current,{}),
        request('/rest/v1/organizations?select=id,name,organization_type,active&active=eq.true&order=name.asc',current),
        request('/rest/v1/tenant_institutions?select=id,name,organization_id,active&active=eq.true&order=name.asc',current),
        request('/rest/v1/rpc/get_compassu_role_assignments',current,{})
      ]);
      setContext(Array.isArray(ctx)?ctx:[]);setOrganizations(Array.isArray(orgs)?orgs:[]);setInstitutions(Array.isArray(insts)?insts:[]);setAssignments(Array.isArray(roles)?roles:[]);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  useEffect(()=>{
    let last='';
    const sync=()=>{const s=readSession();const token=s?.access_token||'';if(token!==last){last=token;if(token)load(s);else{setSession(null);setContext([]);setAssignments([])}}};
    sync();const timer=setInterval(sync,700);return()=>clearInterval(timer);
  },[]);

  useEffect(()=>{
    if(!availableRoles.includes(form.role)&&availableRoles.length)setForm(f=>({...f,role:availableRoles[0]}));
  },[availableRoles,form.role]);

  useEffect(()=>{
    if(form.role==='system_admin'&&form.tenant_institution_id)setForm(f=>({...f,tenant_institution_id:''}));
  },[form.role,form.tenant_institution_id]);

  if(!session||!canManage)return null;

  async function save(){
    if(!form.email.trim())return setError('Enter the email address of an existing CompassU account.');
    if(form.role==='system_admin'&&!form.organization_id)return setError('Select an organization for the System / District Administrator.');
    if(form.role!=='system_admin'&&!form.tenant_institution_id)return setError('Select an institution for this role.');
    setBusy(true);setError('');setNotice('');
    try{
      const message=await request('/rest/v1/rpc/set_compassu_admin_membership',session,{p_user_email:form.email.trim().toLowerCase(),p_role:form.role,p_organization_id:form.organization_id||null,p_tenant_institution_id:form.role==='system_admin'?null:(form.tenant_institution_id||null),p_active:true});
      setNotice(typeof message==='string'?message:'Administrator access updated.');setForm(f=>({...f,email:''}));await load(session);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function deactivate(row){
    if(!window.confirm(`Deactivate ${roleLabel[row.role]||row.role} access for ${row.email}?`))return;
    setBusy(true);setError('');setNotice('');
    try{
      const message=await request('/rest/v1/rpc/set_compassu_admin_membership',session,{p_user_email:row.email,p_role:row.role,p_organization_id:row.organization_id||null,p_tenant_institution_id:row.tenant_institution_id||null,p_active:false});
      setNotice(typeof message==='string'?message:'Administrator access deactivated.');await load(session);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  const selectedInstitution=institutions.find(i=>i.id===form.tenant_institution_id);
  const selectedOrg=form.organization_id||(selectedInstitution?.organization_id||'');

  return <section className="stage3bPanel">
    <div className="stage3bHead">
      <div><div className="adminKicker">STAGE 3B · ROLE-BASED ADMINISTRATION</div><h2>Administrative Access</h2><p>Assign administrative responsibility without granting platform-wide access. Every role is bound to its authorized organization or institution.</p></div>
      <button className="btn ghost" onClick={()=>load(session)} disabled={busy}>{busy?'Refreshing…':'Refresh Access'}</button>
    </div>
    <div className="stage3bContext">{context.map((c,i)=><span key={`${c.role}-${c.organization_id||''}-${c.tenant_institution_id||''}-${i}`}><b>{roleLabel[c.role]||c.role}</b>{c.scope_type==='platform'?'CompassU platform':c.institution_name||c.organization_name}</span>)}</div>
    {error&&<div className="error adminNotice">{error}</div>}{notice&&<div className="success adminNotice">{notice}</div>}
    <div className="stage3bGrid">
      <div className="stage3bCard">
        <h3>Assign Administrative Role</h3><p>The person must already have a CompassU account. New-user provisioning will be handled in Stage 3C.</p>
        <label>Email address</label><input type="email" value={form.email} placeholder="administrator@example.edu" onChange={e=>setForm({...form,email:e.target.value})}/>
        <label>Role</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value,tenant_institution_id:''})}>{availableRoles.map(r=><option key={r} value={r}>{roleLabel[r]}</option>)}</select>
        <label>Organization / System</label><select value={selectedOrg} onChange={e=>setForm({...form,organization_id:e.target.value,tenant_institution_id:''})}><option value="">Select organization</option>{filteredOrganizations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select>
        {form.role!=='system_admin'&&<><label>Institution</label><select value={form.tenant_institution_id} onChange={e=>{const inst=institutions.find(i=>i.id===e.target.value);setForm({...form,tenant_institution_id:e.target.value,organization_id:inst?.organization_id||form.organization_id})}}><option value="">Select institution</option>{filteredInstitutions.map(i=><option value={i.id} key={i.id}>{i.name}</option>)}</select></>}
        <button className="btn primary wide stage3bSave" disabled={busy||!availableRoles.length} onClick={save}>{busy?'Saving…':'Assign Role'}</button>
        <div className="stage3bSafeguard">System Administrators cannot create other System Administrators. Institution Administrators can manage only Counselor / Advisor access within their institution.</div>
      </div>
      <div className="stage3bCard stage3bAssignments">
        <div className="stage3bCardHead"><div><h3>Current Role Assignments</h3><p>Only assignments within your authorized scope are shown.</p></div><b>{assignments.filter(a=>a.active).length} active</b></div>
        <div className="stage3bTableWrap"><table><thead><tr><th>Administrator</th><th>Role</th><th>Scope</th><th>Status</th><th></th></tr></thead><tbody>{assignments.map((a,i)=><tr key={`${a.user_id}-${a.role}-${a.organization_id||''}-${a.tenant_institution_id||''}-${i}`}><td><b>{a.email}</b></td><td>{roleLabel[a.role]||a.role}</td><td><b>{a.institution_name||a.organization_name||'CompassU'}</b>{a.institution_name&&<span>{a.organization_name}</span>}</td><td><span className={`adminStatus ${a.active?'active':'suspended'}`}>{a.active?'Active':'Inactive'}</span></td><td>{a.active&&<button className="stage3bDeactivate" onClick={()=>deactivate(a)} disabled={busy}>Deactivate</button>}</td></tr>)}</tbody></table>{assignments.length===0&&<div className="adminEmpty">No tenant administrator roles have been assigned yet.</div>}</div>
      </div>
    </div>
  </section>;
}
