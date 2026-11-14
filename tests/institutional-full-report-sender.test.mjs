import test from 'node:test';
import assert from 'node:assert/strict';
import {sendInstitutionalFullReport} from '../lib/institutionalFullReportSender.mjs';

const sections = Object.fromEntries([
  'personalityTraits','careerClusters','recommendedMajors','careerOptions',
  'academicStrengths','values','collegeDestinations','recommendedCourses',
  'whyThisPathPointsNorth',
].map(key=>[key,'Synthetic content for '+key]));
const base = {
  job:{id:'job-1',attempt_id:'attempt-1',recipient_id:'recipient-1',
    tenant_institution_id:'institution-1',report_type:'full',status:'processing'},
  recipient:{id:'recipient-1',user_id:'staff-1',email:'representative@example.edu',
    active:true,verified_at:'2026-11-14',tenant_institution_id:'institution-1'},
  attempt:{id:'attempt-1',user_id:'student-1',status:'completed',
    completed_at:'2026-11-14T20:00:00Z',tenant_institution_id:'institution-1'},
  membership:{user_id:'staff-1',tenant_institution_id:'institution-1',active:true},
  studentAffiliation:{attempt_id:'attempt-1',tenant_institution_id:'institution-1',
    evidence_reference:'synthetic-verification'},
  authorization:{attempt_id:'attempt-1',tenant_institution_id:'institution-1',
    approved:true,approved_at:'2026-11-14',revoked_at:null,
    authorization_reference:'synthetic-authorization'},
  settings:{tenant_institution_id:'institution-1',enabled:true,report_mode:'full',
    authorization_reference:'synthetic-institution-approval'},
  studentName:'Synthetic Student',institutionName:'Example College',sections,
};
test('full report delivery fails closed while dispatch policy supports summary only',async()=>{
  let called=false;
  const result=await sendInstitutionalFullReport({...base,dryRun:false,
    fromAddress:'sender@example.edu',sendEmail:async()=>{called=true;return {id:'id'};}});
  assert.deepEqual(result,{status:'skipped',reason:'authorization_denied'});
  assert.equal(called,false);
});
test('a caller-supplied authorized boolean cannot bypass the policy',async()=>{
  let called=false;
  const result=await sendInstitutionalFullReport({...base,authorized:true,dryRun:false,
    fromAddress:'sender@example.edu',sendEmail:async()=>{called=true;return {id:'id'};}});
  assert.equal(result.status,'skipped');
  assert.equal(called,false);
});
test('cross-institution recipient remains blocked',async()=>{
  const result=await sendInstitutionalFullReport({...base,
    recipient:{...base.recipient,tenant_institution_id:'other'}});
  assert.equal(result.status,'skipped');
});
