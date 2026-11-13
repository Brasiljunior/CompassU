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

test('direct reconciliation writes are disabled before any database reads', async () => {
  const db = { from() { throw new Error('unexpected database access'); } };
  await assert.rejects(reconcileInstitutionalCompletions({
    db, attemptIds: ['a', 'a', 'b'], dryRun: false,
  }), /Institutional reconciliation writes are not enabled/);
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
