import test from 'node:test';
import assert from 'node:assert/strict';
import {loadInstitutionalFullReport} from '../lib/institutionalFullReportLoader.mjs';

const attempt={id:'synthetic-attempt',user_id:'synthetic-student',
  status:'completed',completed_at:'2026-11-14T20:00:00Z'};
const sections=Object.fromEntries([
  'personalityTraits','careerClusters','recommendedMajors','careerOptions',
  'academicStrengths','values','collegeDestinations','recommendedCourses',
  'whyThisPathPointsNorth',
].map(key=>[key,'Synthetic '+key]));
const report={attemptId:attempt.id,studentUserId:attempt.user_id,
  completedAt:attempt.completed_at,studentName:'Synthetic Student',
  institutionName:'Synthetic College',tenantInstitutionId:'institution-1',sections};
test('trusted loader accepts complete report matching completed attempt',async()=>{
  const result=await loadInstitutionalFullReport({attempt,
    loadCompletedStudentReport:async args=>{
      assert.deepEqual(args,{attemptId:attempt.id,studentUserId:attempt.user_id});
      return report;
    }});
  assert.equal(result,report);
});
test('missing loader fails closed',async()=>{
  await assert.rejects(loadInstitutionalFullReport({attempt}),/not configured/);
});
test('cross-student report fails closed',async()=>{
  await assert.rejects(loadInstitutionalFullReport({attempt,
    loadCompletedStudentReport:async()=>({...report,studentUserId:'other-student'})}),
    /does not match/);
});
test('missing report section fails closed',async()=>{
  const incomplete={...sections};
  delete incomplete.personalityTraits;
  await assert.rejects(loadInstitutionalFullReport({attempt,
    loadCompletedStudentReport:async()=>({...report,sections:incomplete})}),
    /personalityTraits/);
});
