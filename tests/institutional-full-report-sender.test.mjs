import test from 'node:test';
import assert from 'node:assert/strict';
import {sendInstitutionalFullReport} from '../lib/institutionalFullReportSender.mjs';

const sections = Object.fromEntries([
  'personalityTraits','careerClusters','recommendedMajors','careerOptions',
  'academicStrengths','values','collegeDestinations','recommendedCourses',
  'whyThisPathPointsNorth',
].map(key=>[key,'Synthetic content for '+key]));
const base = {
  authorized:true,
  recipient:{id:'recipient-1',email:'representative@example.edu',active:true,
    verified_at:'2026-11-14',tenant_institution_id:'institution-1'},
  attempt:{id:'attempt-1',status:'completed',completed_at:'2026-11-14T20:00:00Z',
    tenant_institution_id:'institution-1'},
  studentName:'Synthetic Student',institutionName:'Example College',sections,
};
test('preview is the default and never sends',async()=>{
  let called=false;
  const result=await sendInstitutionalFullReport({...base,sendEmail:async()=>{called=true;}});
  assert.equal(result.status,'preview');
  assert.equal(called,false);
  for(const value of Object.values(sections)) assert.ok(result.text.includes(value));
});
test('unauthorized recipient is rejected without sending',async()=>{
  let called=false;
  const result=await sendInstitutionalFullReport({...base,authorized:false,dryRun:false,
    sendEmail:async()=>{called=true;}});
  assert.equal(result.status,'skipped');
  assert.equal(called,false);
});
test('wrong institution is rejected',async()=>{
  const result=await sendInstitutionalFullReport({...base,
    recipient:{...base.recipient,tenant_institution_id:'other'}});
  assert.equal(result.status,'skipped');
});
test('explicit send uses one recipient and stable idempotency key',async()=>{
  let payload;
  const result=await sendInstitutionalFullReport({...base,dryRun:false,fromAddress:'test@example.edu',
    sendEmail:async p=>{payload=p;return {id:'synthetic-provider-id'};}});
  assert.equal(result.status,'sent');
  assert.deepEqual(payload.to,['representative@example.edu']);
  assert.equal(payload.idempotencyKey,'institutional-full-report/attempt-1/recipient-1');
});
