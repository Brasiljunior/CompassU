import test from 'node:test';
import assert from 'node:assert/strict';
import { processClaimedInstitutionalJob } from '../lib/institutionalDeliveryWorker.mjs';

function fakeDb(rows) {
  const updates = [];
  return {
    updates,
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        limit() { return query; },
        async maybeSingle() { return {data:rows[table] ?? null,error:null}; },
        update(value) { updates.push(value); return query; },
      };
      return query;
    },
  };
}
const job = {id:'job-1',status:'processing',claimed_at:'2026-11-14T20:00:00Z',
  attempt_id:'attempt-1',tenant_institution_id:'institution-1',
  recipient_id:'recipient-1',report_type:'full'};
const rows = {
  assessment_attempts:{id:'attempt-1',user_id:'student-1',status:'completed',
    completed_at:'2026-11-14T19:00:00Z'},
  institution_assessment_recipients:{id:'recipient-1',user_id:'staff-1',
    tenant_institution_id:'institution-1',email:'staff@example.edu',
    active:true,verified_at:'2026-11-14T18:00:00Z'},
  institution_assessment_delivery_settings:{tenant_institution_id:'institution-1',
    enabled:true,report_mode:'full',authorization_reference:'synthetic-setting'},
  tenant_institutions:{id:'institution-1',name:'Example College'},
  institution_assessment_affiliations:{attempt_id:'attempt-1',
    tenant_institution_id:'institution-1',evidence_reference:'synthetic-evidence'},
  institution_assessment_authorizations:{attempt_id:'attempt-1',
    tenant_institution_id:'institution-1',approved:true,
    approved_at:'2026-11-14T18:00:00Z',revoked_at:null,
    authorization_reference:'synthetic-consent'},
  institution_memberships:{user_id:'staff-1',tenant_institution_id:'institution-1',
    active:true},
  institution_assessment_delivery_jobs:{id:'job-1'},
};
test('revoked authorization prevents report loading and email delivery',async()=>{
  const db=fakeDb({...rows,institution_assessment_authorizations:{
    ...rows.institution_assessment_authorizations,revoked_at:'2026-11-14T20:01:00Z'}});
  let loaded=false,sent=false;
  const result=await processClaimedInstitutionalJob({db,job,
    loadCompletedStudentReport:async()=>{loaded=true;throw Error('must not load');},
    sendEmail:async()=>{sent=true;throw Error('must not send');}});
  assert.equal(result.status,'skipped');
  assert.equal(loaded,false);
  assert.equal(sent,false);
  assert.equal(db.updates[0].last_error_code,'authorization_denied');
});
test('missing trusted loader cannot trigger full-report email',async()=>{
  const db=fakeDb(rows);
  let sent=false;
  const result=await processClaimedInstitutionalJob({db,job,
    sendEmail:async()=>{sent=true;throw Error('must not send');}});
  assert.equal(result.status,'skipped');
  assert.equal(sent,false);
  assert.equal(db.updates[0].last_error_code,'configuration_error');
});

test('complete synthetic report is delivered in email body to designated recipient',async()=>{
  const db=fakeDb(rows);
  const sections=Object.fromEntries([
    'personalityTraits','careerClusters','recommendedMajors','careerOptions',
    'academicStrengths','values','collegeDestinations','recommendedCourses',
    'whyThisPathPointsNorth',
  ].map(key=>[key,'Synthetic result: '+key]));
  let delivered;
  const result=await processClaimedInstitutionalJob({db,job,
    fromAddress:'results@example.edu',
    loadCompletedStudentReport:async({attemptId,studentUserId})=>{
      assert.equal(attemptId,'attempt-1');
      assert.equal(studentUserId,'student-1');
      return {attemptId,studentUserId,completedAt:rows.assessment_attempts.completed_at,
        studentName:'Synthetic Student',institutionName:'Example College',sections};
    },
    sendEmail:async message=>{delivered=message;return {id:'synthetic-provider-id'};},
  });
  assert.equal(result.status,'sent');
  assert.deepEqual(delivered.to,['staff@example.edu']);
  for(const content of Object.values(sections)) assert.ok(delivered.text.includes(content));
  assert.equal(db.updates[0].provider_message_id,'synthetic-provider-id');
});
