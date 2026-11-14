import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompletedStudentReportLoader} from '../lib/institutionalCompletedReportSnapshot.mjs';
function fakeDb(row) {
  const filters=[];
  const query={
    select(){return query;},
    eq(field,value){filters.push([field,value]);return query;},
    async maybeSingle(){return {data:row,error:null};},
  };
  return {db:{from(table){
    assert.equal(table,'institution_assessment_full_report_snapshots');
    return query;
  }},filters};
}
test('snapshot reader scopes by both attempt and student',async()=>{
  const {db,filters}=fakeDb({
    attempt_id:'a',student_user_id:'u',tenant_institution_id:'t',
    completed_at:'2026-11-14T20:00:00Z',student_name:'Synthetic Student',
    institution_name:'Synthetic College',sections:{personalityTraits:'Synthetic'},
  });
  const report=await createCompletedStudentReportLoader({db})({attemptId:'a',studentUserId:'u'});
  assert.equal(report.tenantInstitutionId,'t');
  assert.deepEqual(filters,[['attempt_id','a'],['student_user_id','u']]);
});
test('missing snapshot fails closed',async()=>{
  const {db}=fakeDb(null);
  await assert.rejects(
    createCompletedStudentReportLoader({db})({attemptId:'a',studentUserId:'u'}),
    /snapshot is unavailable/);
});
