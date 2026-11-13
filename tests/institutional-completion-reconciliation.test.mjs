import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileInstitutionalCompletions } from '../lib/institutionalCompletionReconciliation.mjs';

test('reconciliation rejects oversized batches before database access', async () => {
  await assert.rejects(
    reconcileInstitutionalCompletions({ db: {}, attemptIds: ['a', 'b'], maxBatch: 1 }),
    /exceeds limit/,
  );
});

test('reconciliation rejects invalid IDs before processing any item', async () => {
  await assert.rejects(
    reconcileInstitutionalCompletions({ db: {}, attemptIds: ['valid', '  '] }),
    /Invalid assessment identifier/,
  );
});

test('reconciliation deduplicates attempts and fails closed without valid assessment records', async () => {
  let queries = 0;
  const db = {
    from(table) {
      assert.equal(table, 'assessment_attempts');
      queries++;
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: null, error: null }; },
      };
    },
  };
  const result = await reconcileInstitutionalCompletions({ db, attemptIds: ['a', 'a', 'b'], dryRun: false });
  assert.equal(result.processed, 2);
  assert.equal(result.plannedOrExistingJobs, 0);
  assert.deepEqual(result.results.map(row => row.reason), ['assessment_not_completed', 'assessment_not_completed']);
  assert.equal(queries, 2);
});

test('database failure is isolated and does not expose exception details', async () => {
  const db = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { throw new Error('sensitive database detail'); },
      };
    },
  };
  const result = await reconcileInstitutionalCompletions({ db, attemptIds: ['a', 'b'], dryRun: false });
  assert.deepEqual(result.results.map(row => row.reason), ['processing_error', 'processing_error']);
  assert.equal(JSON.stringify(result).includes('sensitive database detail'), false);
});

test('reconciliation requires a bounded positive integer batch limit', async () => {
  for (const maxBatch of [0, -1, 1.5, 101, '50']) {
    await assert.rejects(
      reconcileInstitutionalCompletions({ db: {}, attemptIds: [], maxBatch }),
      /Invalid trusted reconciliation context/,
    );
  }
});

test('reconciliation rejects missing trusted database and non-array input', async () => {
  await assert.rejects(
    reconcileInstitutionalCompletions({ attemptIds: ['a'] }),
    /Invalid trusted reconciliation context/,
  );
  await assert.rejects(
    reconcileInstitutionalCompletions({ db: {}, attemptIds: 'a' }),
    /Invalid trusted reconciliation context/,
  );
});

test('default reconciliation is a no-write preview', async () => {
  const db = { from() { throw new Error('preview must not query database'); } };
  const result = await reconcileInstitutionalCompletions({ db, attemptIds: ['a', 'a', 'b'] });
  assert.deepEqual(result, {
    processed: 0,
    plannedOrExistingJobs: 0,
    dryRun: true,
    candidateCount: 2,
    results: [],
  });
});

test('reconciliation refuses nonboolean dry-run setting', async () => {
  await assert.rejects(
    reconcileInstitutionalCompletions({ db: {}, attemptIds: [], dryRun: 'false' }),
    /Invalid trusted reconciliation context/,
  );
});
