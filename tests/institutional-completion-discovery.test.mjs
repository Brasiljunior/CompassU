import test from 'node:test';
import assert from 'node:assert/strict';
import { findInstitutionalCompletionCandidates } from '../lib/institutionalCompletionDiscovery.mjs';

test('candidate discovery rejects invalid date windows and excessive limits', async () => {
  for (const limit of [0, 101, 1.5]) {
    await assert.rejects(findInstitutionalCompletionCandidates({
      db: {}, completedAfter: '2026-11-01', completedBefore: '2026-11-02', limit,
    }), /Invalid completion discovery context/);
  }
  await assert.rejects(findInstitutionalCompletionCandidates({
    db: {}, completedAfter: '2026-11-02', completedBefore: '2026-11-01',
  }), /Invalid completion discovery window/);
});

test('candidate discovery reads only completed IDs within bounded window', async () => {
  const calls = [];
  const query = {
    select(value) { calls.push(['select', value]); return this; },
    eq(key, value) { calls.push(['eq', key, value]); return this; },
    gte(key, value) { calls.push(['gte', key, value]); return this; },
    lt(key, value) { calls.push(['lt', key, value]); return this; },
    order(key, options) { calls.push(['order', key, options]); return this; },
    async limit(value) {
      calls.push(['limit', value]);
      return { data: [{ id: 'a' }, { id: 'b' }, { id: '' }], error: null };
    },
  };
  const db = { from(table) { assert.equal(table, 'assessment_attempts'); return query; } };
  const ids = await findInstitutionalCompletionCandidates({
    db, completedAfter: '2026-11-01', completedBefore: '2026-11-02', limit: 2,
  });
  assert.deepEqual(ids, ['a', 'b']);
  assert.deepEqual(calls[0], ['select', 'id,completed_at']);
  assert.deepEqual(calls[1], ['eq', 'status', 'completed']);
  assert.deepEqual(calls.at(-1), ['limit', 2]);
});

test('candidate discovery propagates database failures without returning partial IDs', async () => {
  const query = {
    select() { return this; }, eq() { return this; }, gte() { return this; },
    lt() { return this; }, order() { return this; },
    async limit() { return { data: [{ id: 'a' }], error: new Error('query failed') }; },
  };
  await assert.rejects(findInstitutionalCompletionCandidates({
    db: { from() { return query; } },
    completedAfter: '2026-11-01', completedBefore: '2026-11-02',
  }), /query failed/);
});
