import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverAutomaticInstitutionalReport } from '../lib/institutionalAutomaticDeliveryOrchestrator.mjs';

const attemptId='123e4567-e89b-42d3-a456-426614174000';
const completedAt='2026-11-15T17:00:00Z';
const institution='Southwest Tennessee Community College';
const sections=Object.fromEntries(['personalityTraits','careerClusters','recommendedMajors','careerOptions','academicStrengths','values','collegeDestinations','recommendedCourses','whyThisPathPointsNorth'].map(k=>[k,'Full '+k]));
const context={
 attempt:{id:attemptId,user_id:'student-1',status:'completed',completed_at:completedAt},
 accountEmail:'student@example.edu',
 assignments:[{email:'student@example.edu',institution,tenant_institution_id:null}],
 recipients:[{institution,email:'representative@example.edu',active:true}],
 institutionAuthorization:{institution_name:institution,approved:true,approved_at:completedAt,authorization_reference:'signed-agreement',revoked_at:null},
 report:{attempt_id:attemptId,student_user_id:'student-1',completed_at:completedAt,institution_name:institution,sections},
 studentName:'Test Student'
};
const makeDeps=(overrides={})=>({
 attemptId,completionEvent:{source:'trusted_assessment_finalization',attemptId,isNewCompletion:true},loadTrustedContext:async()=>context,fromAddress:'CompassU <results@example.com>',
 claimDelivery:async()=>({claimed:true}),recordDelivery:async()=>{},
 sendEmail:async()=>({id:'resend-message-1'}),...overrides
});
test('sends complete sections to only the configured recipient after claiming',async()=>{
 const sent=[],recorded=[];
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  sendEmail:async message=>{sent.push(message);return{id:'resend-message-1'}},
  recordDelivery:async item=>recorded.push(item)
 }));
 assert.equal(result.status,'accepted');
 assert.deepEqual(sent[0].to,['representative@example.edu']);
 for(const value of Object.values(sections))assert.ok(sent[0].text.includes(value));
 assert.equal(recorded[0].status,'sent');
});
test('does not send when another worker already claimed the delivery',async()=>{
 let sent=0;
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  claimDelivery:async()=>({claimed:false,reason:'already_sent'}),
  sendEmail:async()=>{sent++;return{id:'message'}}
 }));
 assert.equal(result.status,'skipped');assert.equal(sent,0);
});
test('does not send without verified institution authorization',async()=>{
 let sent=0;
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  loadTrustedContext:async()=>({...context,institutionAuthorization:null}),
  sendEmail:async()=>{sent++;return{id:'message'}}
 }));
 assert.equal(result.status,'blocked');assert.equal(sent,0);
});
test('keeps provider acceptance separate from failed database recording',async()=>{
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  recordDelivery:async()=>{throw new Error('database unavailable')}
 }));
 assert.equal(result.status,'reconciliation_required');
 assert.equal(result.providerMessageId,'resend-message-1');
});
test('rejects malformed attempt IDs before reading student data',async()=>{
 let read=0;
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  attemptId:'bad-id',loadTrustedContext:async()=>{read++;return context}
 }));
 assert.equal(result.status,'blocked');assert.equal(read,0);
});

test('requires reconciliation when provider and status recording both fail',async()=>{
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  sendEmail:async()=>{throw new Error('network timeout')},
  recordDelivery:async()=>{throw new Error('database unavailable')}
 }));
 assert.equal(result.status,'reconciliation_required');
 assert.equal(result.reason,'provider_and_recording_outcomes_uncertain');
});
test('records uncertain provider outcome without automatically retrying',async()=>{
 let sends=0;const records=[];
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  sendEmail:async()=>{sends++;throw new Error('network timeout')},
  recordDelivery:async item=>records.push(item)
 }));
 assert.equal(result.status,'failed');assert.equal(sends,1);
 assert.equal(records[0].error,'provider_outcome_uncertain');
});

test('never backfills historical completed test assessments',async()=>{
 let reads=0,sends=0;
 const result=await deliverAutomaticInstitutionalReport(makeDeps({
  completionEvent:{source:'trusted_assessment_finalization',attemptId,isNewCompletion:false},
  loadTrustedContext:async()=>{reads++;return context},
  sendEmail:async()=>{sends++;return{id:'message'}}
 }));
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'fresh_completion_event_required');
 assert.equal(reads,0);assert.equal(sends,0);
});
test('rejects a browser-asserted or mismatched completion event',async()=>{
 for(const completionEvent of [
  {source:'browser',attemptId,isNewCompletion:true},
  {source:'trusted_assessment_finalization',attemptId:'other',isNewCompletion:true},
  null
 ]){
  const result=await deliverAutomaticInstitutionalReport(makeDeps({completionEvent}));
  assert.equal(result.status,'blocked');
 }
});
