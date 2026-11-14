import test from 'node:test';
import assert from 'node:assert/strict';
import { auditInstitutionalCompletionReadiness } from '../lib/institutionalCompletionReadinessAudit.mjs';

function dbFor() {
  const reads = [];
  const rows = {
    assessment_attempts: { id: 'a1', user_id: 'u1', status: 'completed', completed_at: '2026-11-14T10:00:00Z' },
    institution_student_assignments: null,
  };
  return {
    reads,
    from(table) {
      reads.push(table);
      assert.ok(Object.hasOwn(rows, table), 'Unexpected table ' + table);
      return {
        select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: rows[table], error: null }; },
      };
    },
  };
}

test('readiness audit returns only aggregate blockers and never queues delivery', async () => {
  const db = dbFor();
  assert.deepEqual(await auditInstitutionalCompletionReadiness({
    db, attemptIds: ['a1', 'a1'],
  }), {
    inspected: 1, ready: 0, blocked: 1,
    reasons: { student_assignment_not_verified: 1 }, dryRun: true,
  });
  assert.deepEqual(db.reads, ['assessment_attempts','institution_student_assignments']);
});

test('audit rejects invalid or unbounded batches before reading database', async () => {
  const db = dbFor();
  for (const attemptIds of [null, [''], Array.from({ length: 101 }, (_, i) => String(i))]) {
    await assert.rejects(auditInstitutionalCompletionReadiness({ db, attemptIds }),
      /Invalid trusted institutional readiness audit context/);
  }
  assert.deepEqual(db.reads, []);
});

test('empty batch is a valid no-write audit', async () => {
  assert.deepEqual(await auditInstitutionalCompletionReadiness({
    db: dbFor(), attemptIds: [],
  }), { inspected: 0, ready: 0, blocked: 0, reasons: {}, dryRun: true });
});
