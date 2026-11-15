import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAutomaticInstitutionalDelivery } from '../lib/institutionalAutomaticDeliveryPreflight.mjs';

const institution='Southwest Tennessee Community College';
const completedAt='2026-11-15T17:00:00Z';
const attempt={id:'attempt-1',user_id:'student-1',status:'completed',completed_at:completedAt};
const assignments=[{email:'student@example.edu',institution,tenant_institution_id:null}];
const recipients=[{institution,email:'representative@example.edu',active:true}];
const institutionAuthorization={institution_name:institution,approved:true,approved_at:completedAt,revoked_at:null,authorization_reference:'signed-institution-agreement'};
const sections=Object.fromEntries(['personalityTraits','careerClusters','recommendedMajors','careerOptions','academicStrengths','values','collegeDestinations','recommendedCourses','whyThisPathPointsNorth'].map(k=>[k,'Verified student-specific '+k]));
const report={attempt_id:attempt.id,student_user_id:attempt.user_id,completed_at:completedAt,institution_name:institution,sections};
const args={attempt,accountEmail:'student@example.edu',assignments,recipients,institutionAuthorization,report,studentName:'Test Student'};

test('prepares all nine report sections for the designated institution recipient',()=>{
 const result=prepareAutomaticInstitutionalDelivery(args);
 assert.equal(result.ready,true);
 assert.deepEqual(result.recipientEmails,['representative@example.edu']);
 for(const section of Object.values(sections)) assert.ok(result.text.includes(section));
 assert.ok(result.subject.includes('Test Student'));
});
test('blocks delivery when institutional authorization is absent or revoked',()=>{
 for(const authorization of [null,{...institutionAuthorization,approved:false},{...institutionAuthorization,revoked_at:completedAt},{...institutionAuthorization,authorization_reference:''}]){
  const result=prepareAutomaticInstitutionalDelivery({...args,institutionAuthorization:authorization});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'institutional_disclosure_authorization_missing');
 }
});
test('blocks delivery for a report belonging to another student or assessment',()=>{
 for(const bad of [{...report,student_user_id:'another-student'},{...report,attempt_id:'another-attempt'},{...report,institution_name:'Other College'}]){
  const result=prepareAutomaticInstitutionalDelivery({...args,report:bad});
  assert.equal(result.ready,false);
  assert.equal(result.reason,'verified_complete_report_missing');
 }
});
test('blocks incomplete attempts and inactive recipient addresses',()=>{
 assert.equal(prepareAutomaticInstitutionalDelivery({...args,attempt:{...attempt,status:'in_progress'}}).ready,false);
 assert.equal(prepareAutomaticInstitutionalDelivery({...args,recipients:[{...recipients[0],active:false}]}).ready,false);
});

test('blocks ambiguous recipient configuration',()=>{
 const result=prepareAutomaticInstitutionalDelivery({...args,recipients:[...recipients,{institution,email:'second@example.edu',active:true}]});
 assert.equal(result.ready,false);
 assert.equal(result.reason,'multiple_institutional_recipients_require_resolution');
});
test('blocks malformed completion timestamps even when both dates are invalid',()=>{
 const result=prepareAutomaticInstitutionalDelivery({...args,
  attempt:{...attempt,completed_at:'not-a-date'},
  report:{...report,completed_at:'also-not-a-date'}});
 assert.equal(result.ready,false);
 assert.equal(result.reason,'verified_complete_report_missing');
});

test('blocks authorization dated after the assessment was completed',()=>{
 const result=prepareAutomaticInstitutionalDelivery({...args,
  institutionAuthorization:{...institutionAuthorization,approved_at:'2026-11-16T00:00:00Z'}});
 assert.equal(result.ready,false);
 assert.equal(result.reason,'institutional_disclosure_authorization_missing');
});
test('blocks invalid authorization timestamps',()=>{
 const result=prepareAutomaticInstitutionalDelivery({...args,
  institutionAuthorization:{...institutionAuthorization,approved_at:'not-a-date'}});
 assert.equal(result.ready,false);
});

test('blocks missing or empty full-report sections without throwing',()=>{
 for(const missing of ['personalityTraits','careerClusters','recommendedMajors','careerOptions','academicStrengths','values','collegeDestinations','recommendedCourses','whyThisPathPointsNorth']){
  const partial={...sections,[missing]:''};
  const result=prepareAutomaticInstitutionalDelivery({...args,report:{...report,sections:partial}});
  assert.deepEqual(result,{ready:false,reason:'verified_complete_report_missing'});
 }
});
test('blocks missing student name before any email is prepared',()=>{
 const result=prepareAutomaticInstitutionalDelivery({...args,studentName:''});
 assert.equal(result.ready,false);
 assert.equal(result.reason,'verified_complete_report_missing');
});
