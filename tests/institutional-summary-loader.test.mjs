import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthorizedInstitutionalSummary } from '../lib/institutionalSummaryLoader.mjs';

function scoringDb() {
  let reads = 0;
  return {
    get reads() { return reads; },
    from(table) {
      assert.equal(table, 'major_matches');
      reads++;
      return {
        select(fields) {
          assert.equal(fields, 'major_id,match_score,rank,majors(name)');
          return this;
        },
        eq(field, value) { assert.equal(field, 'attempt_id'); assert.equal(value, 'attempt-1'); return this; },
        order() { return this; },
        async limit() {
          return { data: [{ major_id: 7, rank: 1, match_score: 92, majors: { name: 'Biology' }, private_note: 'never disclose' }], error: null };
        },
      };
    },
  };
}
const approved = { allowed: true, attemptId: 'attempt-1', jobId: 'job-1', reportType: 'summary' };
const args = db => ({ db, authenticatedUserId: 'viewer-1', jobId: 'job-1' });

test('denied recipient cannot trigger a scoring query', async () => {
  const db = scoringDb();
  const result = await loadAuthorizedInstitutionalSummary({ ...args(db), authorize: async () => ({ allowed: false }) });
  assert.equal(result.status, 'denied');
  assert.equal(db.reads, 0);
});

test('authorized summary is bounded and excludes raw private data', async () => {
  const db = scoringDb();
  let checks = 0;
  const result = await loadAuthorizedInstitutionalSummary({ ...args(db), authorize: async () => { checks++; return approved; } });
  assert.equal(checks, 2);
  assert.equal(result.status, 'available');
  assert.equal(result.report.content.topMajors[0].major, 'Biology');
  assert.equal(JSON.stringify(result).includes('never disclose'), false);
});

test('revocation between scoring read and response denies report', async () => {
  const db = scoringDb();
  let checks = 0;
  const result = await loadAuthorizedInstitutionalSummary({
    ...args(db), authorize: async () => ++checks === 1 ? approved : { allowed: false },
  });
  assert.equal(checks, 2);
  assert.equal(result.status, 'denied');
});

test('switching authorized assessment between checks denies report', async () => {
  const result = await loadAuthorizedInstitutionalSummary({
    ...args(scoringDb()),
    authorize: async (() => { let checks = 0; return () => ++checks === 1 ? approved : { ...approved, attemptId: 'attempt-2' }; })(),
  });
  assert.equal(result.status, 'denied');
});

test('initial authorization for a different job cannot trigger scoring retrieval', async () => {
  const db = scoringDb();
  const result = await loadAuthorizedInstitutionalSummary({
    ...args(db), authorize: async () => ({ ...approved, jobId: 'another-job' }),
  });
  assert.equal(result.status, 'denied');
  assert.equal(db.reads, 0);
});

test('report-type change during retrieval denies the executive summary', async () => {
  let checks = 0;
  const result = await loadAuthorizedInstitutionalSummary({
    ...args(scoringDb()),
    authorize: async () => ++checks === 1 ? approved : { ...approved, reportType: 'full' },
  });
  assert.equal(result.status, 'denied');
  assert.equal(checks, 2);
});
