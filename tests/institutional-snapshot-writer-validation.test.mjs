import test from 'node:test';
import assert from 'node:assert/strict';
import {persistInstitutionalFullReportSnapshot} from '../lib/institutionalSnapshotWriter.mjs';

const sections=Object.fromEntries([
 'personalityTraits','careerClusters','recommendedMajors','careerOptions',
 'academicStrengths','values','collegeDestinations','recommendedCourses',
 'whyThisPathPointsNorth',
].map(key=>[key,'Synthetic '+key]));

test('snapshot writer rejects invalid email headers before persistence',async()=>{
 let inserted=false;
 const rows={
  assessment_attempts:{id:'attempt-1',user_id:'student-1',status:'completed',completed_at:'2026-11-14T20:00:00Z'},
  institution_assessment_affiliations:{attempt_id:'attempt-1',tenant_institution_id:'institution-1',evidence_reference:'verified'},
  institution_assessment_authorizations:{attempt_id:'attempt-1',tenant_institution_id:'institution-1',approved:true,approved_at:'2026-11-14T19:00:00Z',revoked_at:null,authorization_reference:'approved'},
 };
 const db={from(table){
  const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:rows[table],error:null};},
   async insert(){inserted=true;return {error:null};}};
  return query;
 }};
 await assert.rejects(persistInstitutionalFullReportSnapshot({
  db,attemptId:'attempt-1',
  generateReport:async()=>({
   attemptId:'attempt-1',studentUserId:'student-1',tenantInstitutionId:'institution-1',
   completedAt:'2026-11-14T20:00:00Z',studentName:'Synthetic\nBcc: outsider@example.edu',
   institutionName:'Example College',sections,
  }),
 }),/Invalid email header field/);
 assert.equal(inserted,false);
});

test('identical immutable snapshot conflict is accepted as an idempotent retry',async()=>{
 const attempt={id:'attempt-1',user_id:'student-1',status:'completed',completed_at:'2026-11-14T20:00:00Z'};
 const affiliation={attempt_id:'attempt-1',tenant_institution_id:'institution-1',evidence_reference:'verified'};
 const authorization={attempt_id:'attempt-1',tenant_institution_id:'institution-1',approved:true,
  approved_at:'2026-11-14T19:00:00Z',revoked_at:null,authorization_reference:'approved'};
 const snapshot={attempt_id:'attempt-1',student_user_id:'student-1',
  tenant_institution_id:'institution-1',completed_at:attempt.completed_at,
  student_name:'Synthetic Student',institution_name:'Example College',sections,report_schema_version:1};
 const rows={assessment_attempts:attempt,institution_assessment_affiliations:affiliation,
  institution_assessment_authorizations:authorization,institution_assessment_full_report_snapshots:snapshot};
 let inserts=0;
 const db={from(table){
  const query={select(){return query;},eq(){return query;},
   async maybeSingle(){return {data:rows[table],error:null};},
   async insert(){inserts++;return {error:{code:'23505',message:'duplicate key'}};}};
  return query;
 }};
 const result=await persistInstitutionalFullReportSnapshot({
  db,attemptId:'attempt-1',generateReport:async()=>({
   attemptId:'attempt-1',studentUserId:'student-1',tenantInstitutionId:'institution-1',
   completedAt:attempt.completed_at,studentName:'Synthetic Student',
   institutionName:'Example College',sections,
  }),
 });
 assert.equal(inserts,1);
 assert.equal(result.reason,'already_stored');
 rows.institution_assessment_full_report_snapshots={...snapshot,student_name:'Different Student'};
 await assert.rejects(persistInstitutionalFullReportSnapshot({
  db,attemptId:'attempt-1',generateReport:async()=>({
   attemptId:'attempt-1',studentUserId:'student-1',tenantInstitutionId:'institution-1',
   completedAt:attempt.completed_at,studentName:'Synthetic Student',
   institutionName:'Example College',sections,
  }),
 }),/Immutable institutional report snapshot conflict/);
});
