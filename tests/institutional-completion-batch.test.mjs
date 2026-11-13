import test from 'node:test';
import assert from 'node:assert/strict';
import { runInstitutionalCompletionBatch } from '../lib/institutionalCompletionBatch.mjs';

function database(ids) {
  const reads = [];
  const query = {
    select() { return this; }, eq() { return this; }, gte() { return this; },
    lt() { return this; }, order() { return this; },
    async limit() { return { data: ids.map(id => ({ id })), error: null }; },
  };
  return {
    reads,
    from(table) {
      reads.push(table);
      assert.equal(table, 'assessment_attempts');
      return query;
    },
  };
}
const window = { completedAfter: '2026-11-01', completedBefore: '2026-11-02' };

test('institutional batch defaults to no-write discovery and preview', async () => {
  const db = database(['a', 'b']);
  const result = await runInstitutionalCompletionBatch({ db, ...window, limit: 3 });
  assert.equal(result.dryRun, true);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.processed, 0);
  assert.equal(result.potentiallyMoreCandidates, false);
  assert.deepEqual(db.reads, ['assessment_attempts']);
});

test('full candidate batch warns that further records may exist', async () => {
  const result = await runInstitutionalCompletionBatch({ db: database(['a', 'b']), ...window, limit: 2 });
  assert.equal(result.potentiallyMoreCandidates, true);
});

test('invalid batch mode fails before database access', async () => {
  const db = { from() { throw new Error('unexpected database access'); } };
  await assert.rejects(runInstitutionalCompletionBatch({ db, ...window, dryRun: 'false' }),
    /Invalid institutional batch mode/);
});

test('write-enabled reconciliation remains blocked before any database access', async () => {
  const db = { from() { throw new Error('unexpected database access'); } };
  await assert.rejects(runInstitutionalCompletionBatch({
    db, ...window, dryRun: false,
  }), /Institutional reconciliation writes are not enabled/);
});
