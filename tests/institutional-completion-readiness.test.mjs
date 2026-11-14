import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectInstitutionalCompletionReadiness } from '../lib/institutionalCompletionReadiness.mjs';

const attempt = { id: 'a1', user_id: 'u1', status: 'completed', completed_at: '2026-11-14T10:00:00Z' };
const assignment = { user_id: 'u1', tenant_institution_id: 't1', evidence_reference: 'onboard-1', verified_at: '2026-11-14T09:00:00Z' };
const snapshot = { attempt_id: 'a1', tenant_institution_id: 't1', evidence_reference: 'onboard-1' };

function dbFor({ a = attempt, s = assignment, snap = snapshot } = {}) {
  const reads = [];
  const rows = { assessment_attempts: a, institution_student_assignments: s, institution_assessment_affiliations: snap };
  return {
    reads,
    from(table) {
      reads.push(table);
      assert.ok(Object.hasOwn(rows, table), 'Unexpected table: ' + table);
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: rows[table], error: null }; },
      };
    },
  };
}

test('matching verified assignment and snapshot are eligible for later authorization checks', async () => {
  const db = dbFor();
  assert.deepEqual(await inspectInstitutionalCompletionReadiness({ db, attemptId: 'a1' }),
    { ready: true, reason: 'verified_assignment_and_snapshot_match' });
  assert.deepEqual(db.reads, ['assessment_attempts','institution_student_assignments','institution_assessment_affiliations']);
});

test('incomplete attempt never queries institutional information', async () => {
  const db = dbFor({ a: { ...attempt, status: 'in_progress', completed_at: null } });
  assert.deepEqual(await inspectInstitutionalCompletionReadiness({ db, attemptId: 'a1' }),
    { ready: false, reason: 'assessment_not_completed' });
  assert.deepEqual(db.reads, ['assessment_attempts']);
});

test('unverified student assignment stops before snapshot lookup', async () => {
  const db = dbFor({ s: null });
  assert.deepEqual(await inspectInstitutionalCompletionReadiness({ db, attemptId: 'a1' }),
    { ready: false, reason: 'student_assignment_not_verified' });
  assert.deepEqual(db.reads, ['assessment_attempts','institution_student_assignments']);
});

test('missing snapshot is not backfilled from current assignment', async () => {
  const db = dbFor({ snap: null });
  assert.deepEqual(await inspectInstitutionalCompletionReadiness({ db, attemptId: 'a1' }),
    { ready: false, reason: 'student_affiliation_not_verified' });
  assert.equal(db.reads.includes('institution_assessment_delivery_jobs'), false);
});

test('assignment verified after assessment completion cannot establish historical affiliation', async () => {
  const db = dbFor({ s: { ...assignment, verified_at: '2026-11-14T11:00:00Z' } });
  assert.deepEqual(await inspectInstitutionalCompletionReadiness({ db, attemptId: 'a1' }),
    { ready: false, reason: 'assignment_not_verified_at_completion' });
  assert.deepEqual(db.reads, ['assessment_attempts','institution_student_assignments']);
});

test('institution reassignment conflicts fail closed without writing', async () => {
  const db = dbFor({ snap: { ...snapshot, tenant_institution_id: 't2' } });
  assert.deepEqual(await inspectInstitutionalCompletionReadiness({ db, attemptId: 'a1' }),
    { ready: false, reason: 'assignment_snapshot_mismatch' });
  assert.equal(db.reads.includes('institution_assessment_authorizations'), false);
});
