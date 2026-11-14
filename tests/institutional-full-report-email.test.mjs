import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInstitutionalFullReportEmail} from '../lib/institutionalFullReportEmail.mjs';

const sections = {
  personalityTraits: 'Analytical and collaborative',
  careerClusters: 'Health science',
  recommendedMajors: 'Nursing',
  careerOptions: 'Registered nurse; salary and outlook',
  academicStrengths: 'Biology',
  values: 'Helping others',
  collegeDestinations: 'Home institution: nursing program',
  recommendedCourses: 'Biology and volunteering',
  whyThisPathPointsNorth: 'Your interests and strengths align',
};
test('full report email includes every assessment section directly in body', () => {
  const result = buildInstitutionalFullReportEmail({
    studentName:'Synthetic Student',institutionName:'Example College',
    completedAt:'2026-11-14T20:00:00Z',sections,
  });
  for (const value of Object.values(sections)) assert.ok(result.text.includes(value));
  assert.match(result.text,/Synthetic Student/);
  assert.doesNotMatch(result.text,/https?:\/\//);
});
test('missing report section fails closed rather than sending partial report', () => {
  const incomplete = {...sections};
  delete incomplete.personalityTraits;
  assert.throws(() => buildInstitutionalFullReportEmail({
    studentName:'Synthetic Student',institutionName:'Example College',
    completedAt:'2026-11-14T20:00:00Z',sections:incomplete,
  }),/personalityTraits/);
});
test('invalid completion metadata fails closed', () => {
  assert.throws(() => buildInstitutionalFullReportEmail({
    studentName:'Synthetic Student',institutionName:'Example College',
    completedAt:'not a date',sections,
  }),/completion date/);
});
