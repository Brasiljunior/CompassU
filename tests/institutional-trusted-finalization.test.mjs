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
