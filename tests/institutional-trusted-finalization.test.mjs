import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeInstitutionalAssessmentDelivery } from '../lib/institutionalTrustedFinalization.mjs';

test('trusted completion orchestration rejects missing server-side generator', async () => {
  await assert.rejects(
    finalizeInstitutionalAssessmentDelivery({
      db:{from(){throw new Error('database must not be accessed');}},
      attemptId:'synthetic-attempt',completedUserId:'synthetic-user',
    }),
    /Trusted institutional finalization context required/,
  );
});
test('trusted completion orchestration rejects missing privileged database', async () => {
  await assert.rejects(
    finalizeInstitutionalAssessmentDelivery({
      attemptId:'synthetic-attempt',completedUserId:'synthetic-user',
      generateReport:async()=>{throw new Error('must not generate');},
    }),
    /Trusted institutional finalization context required/,
  );
});

test('unverified completion cannot generate a report or queue delivery', async () => {
  let generated=false;
  let touchedOutbox=false;
  const db={from(table){
    if(table==='institution_assessment_delivery_jobs') touchedOutbox=true;
    const query={
      select(){return query;},eq(){return query;},
      async maybeSingle(){return {data:null,error:null};},
    };
    return query;
  }};
  const result=await finalizeInstitutionalAssessmentDelivery({
    db,attemptId:'synthetic-attempt',completedUserId:'synthetic-user',
    generateReport:async()=>{generated=true;throw new Error('must not generate');},
  });
  assert.deepEqual(result,{queued:0,stage:'affiliation',reason:'assessment_not_completed_or_owner_mismatch'});
  assert.equal(generated,false);
  assert.equal(touchedOutbox,false);
});

test('disabled full-report mode cannot generate a sensitive report',async()=>{
 let generated=false;
 const rows={
  assessment_attempts:{id:'synthetic-attempt',user_id:'synthetic-user',
   status:'completed',completed_at:new Date().toISOString()},
  institution_student_assignments:{user_id:'synthetic-user',tenant_institution_id:'synthetic-tenant',
   assigned_at:'2026-11-01T00:00:00Z',verified_at:'2026-11-01T00:00:00Z',
   evidence_reference:'synthetic-evidence'},
  institution_assessment_affiliations:{attempt_id:'synthetic-attempt',
   tenant_institution_id:'synthetic-tenant',evidence_reference:'synthetic-evidence'},
  institution_assessment_delivery_settings:{enabled:false,report_mode:'full'},
 };
 const db={from(table){
  const query={select(){return query;},eq(){return query;},limit(){return query;},
   async maybeSingle(){return {data:rows[table]??null,error:null};}};
  return query;
 }};
 const result=await finalizeInstitutionalAssessmentDelivery({
  db,attemptId:'synthetic-attempt',completedUserId:'synthetic-user',
  generateReport:async()=>{generated=true;throw new Error('must not generate');},
 });
 assert.equal(generated,false);
 assert.equal(result.queued,0);
});
