import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInstitutionalExecutiveSummary } from '../lib/institutionalExecutiveSummary.mjs';

test('executive summary returns ranked top five major matches only', () => {
  const matches = Array.from({ length: 7 }, (_, i) => ({
    major_id: i + 1, rank: 7 - i, match_score: 70 + i,
    majors: { name: 'Major ' + (i + 1) },
    student_email: 'private@example.edu', response_value: 'sensitive answer',
  }));
  const result = buildInstitutionalExecutiveSummary({ matches, attemptId: 'attempt-1' });
  assert.equal(result.topMajors.length, 5);
  assert.equal(result.topMajors[0].rank, 1);
  assert.equal(JSON.stringify(result).includes('private@example.edu'), false);
  assert.equal(JSON.stringify(result).includes('sensitive answer'), false);
});

test('executive summary ignores invalid scores and duplicate major IDs', () => {
  const result = buildInstitutionalExecutiveSummary({
    attemptId: 'attempt-1',
    matches: [
      { major_id: 1, rank: 1, match_score: 88, majors: { name: 'Engineering' } },
      { major_id: 1, rank: 2, match_score: 82, majors: { name: 'Engineering' } },
      { major_id: 2, rank: 3, match_score: 10000, majors: { name: 'Invalid' } },
    ],
  });
  assert.deepEqual(result.topMajors, [{ rank: 1, major: 'Engineering', matchScore: 88 }]);
});

test('executive summary rejects missing assessment context', () => {
  assert.throws(() => buildInstitutionalExecutiveSummary({ attemptId: '', matches: [] }), /Invalid assessment/);
});
