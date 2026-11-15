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
   completedAt:'2026-11-14T20:00:00Z',studentName:'Synthetic\\nBcc: outsider@example.edu',
   institutionName:'Example College',sections,
  }),
 }),/Invalid email header field/);
 assert.equal(inserted,false);
});
