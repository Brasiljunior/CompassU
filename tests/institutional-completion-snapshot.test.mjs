import test from 'node:test';
import assert from 'node:assert/strict';
import {captureCompletedAssessmentForInstitution} from '../lib/institutionalCompletionSnapshot.mjs';
const keys=['personalityTraits','careerClusters','recommendedMajors','careerOptions','academicStrengths','values','collegeDestinations','recommendedCourses','whyThisPathPointsNorth'];
function fixture({completed=true,approved=true}={}){
 const inserted=[];
 const records={
  assessment_attempts:{id:'attempt-1',user_id:'student-1',status:completed?'completed':'in_progress',completed_at:completed?'2026-11-14T20:00:00Z':null},
  institution_assessment_affiliations:{attempt_id:'attempt-1',tenant_institution_id:'institution-1',evidence_reference:'verified'},
  institution_assessment_authorizations:{attempt_id:'attempt-1',tenant_institution_id:'institution-1',approved,approved_at:approved?'2026-11-14T19:00:00Z':null,revoked_at:null,authorization_reference:approved?'consent':null}
 };
 return {inserted,from(table){return {select(){return this},eq(){return this},async maybeSingle(){return {data:records[table],error:null}},async insert(record){inserted.push({table,record});return {error:null}}}}};
}
const report=async ({attemptId,studentUserId,tenantInstitutionId})=>({attemptId,studentUserId,tenantInstitutionId,completedAt:'2026-11-14T20:00:00Z',studentName:'Test Student',institutionName:'Test College',sections:Object.fromEntries(keys.map(k=>[k,'Verified '+k]))});
test('stores all nine sections',async()=>{const db=fixture();const r=await captureCompletedAssessmentForInstitution({db,attemptId:'attempt-1',generateReport:report});assert.equal(r.stored,true);assert.deepEqual(Object.keys(db.inserted[0].record.sections),keys)});
test('does not generate incomplete assessment',async()=>{const db=fixture({completed:false});let called=false;await assert.rejects(captureCompletedAssessmentForInstitution({db,attemptId:'attempt-1',generateReport:async()=>{called=true;return report({})}}));assert.equal(called,false);assert.equal(db.inserted.length,0)});
test('does not generate without authorization',async()=>{const db=fixture({approved:false});let called=false;await assert.rejects(captureCompletedAssessmentForInstitution({db,attemptId:'attempt-1',generateReport:async()=>{called=true;return report({})}}));assert.equal(called,false);assert.equal(db.inserted.length,0)});
