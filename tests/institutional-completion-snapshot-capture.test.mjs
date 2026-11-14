import test from 'node:test';
import assert from 'node:assert/strict';
import { captureCompletedAssessmentAffiliation } from '../lib/institutionalCompletionSnapshotCapture.mjs';

const completedAt = new Date(Date.now() - 60_000).toISOString();
const verifiedAt = new Date(Date.now() - 120_000).toISOString();
const attempt = { id: 'a1', user_id: 'u1', status: 'completed', completed_at: completedAt };
const assignment = { user_id: 'u1', tenant_institution_id: 't1', evidence_reference: 'verified-onboarding', verified_at: verifiedAt };
function fakeDb({ a = attempt, s = assignment, snapshot = null, insertError = null, concurrentSnapshot = null } = {}) {
  const inserts = [];
  let snapshotReads = 0;
  const rows = { assessment_attempts: a, institution_student_assignments: s, institution_assessment_affiliations: snapshot };
  return {
    inserts,
    from(table) {
      let value;
      return {
        select() { return this; },
        eq(_column, v) { value = v; return this; },
        async maybeSingle() {
          if (table === 'institution_assessment_affiliations' && ++snapshotReads === 2) {
            return { data: concurrentSnapshot, error: null };
          }
          return { data: rows[table], error: null };
        },
        async insert(payload) { inserts.push({ table, payload }); return { error: insertError }; },
      };
    },
  };
}
test('captures verified completion snapshot without sending delivery', async () => {
  const db = fakeDb();
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'u1' }),
    { captured: true, reason: 'captured' });
  assert.deepEqual(db.inserts, [{ table: 'institution_assessment_affiliations', payload: {
    attempt_id: 'a1', tenant_institution_id: 't1', evidence_reference: 'verified-onboarding',
  } }]);
});
test('refuses to capture from a mismatched student', async () => {
  const db = fakeDb();
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'other' }),
    { captured: false, reason: 'assessment_not_completed_or_owner_mismatch' });
  assert.equal(db.inserts.length, 0);
});
test('refuses retroactive institutional verification', async () => {
  const db = fakeDb({ s: { ...assignment, verified_at: new Date(Date.now() - 30_000).toISOString() } });
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'u1' }),
    { captured: false, reason: 'assignment_not_verified_at_completion' });
  assert.equal(db.inserts.length, 0);
});
test('refuses to replace conflicting historical snapshot', async () => {
  const db = fakeDb({ snapshot: { attempt_id: 'a1', tenant_institution_id: 't2', evidence_reference: 'other' } });
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'u1' }),
    { captured: false, reason: 'immutable_snapshot_conflict' });
  assert.equal(db.inserts.length, 0);
});


test('refuses to backfill a completed assessment from an old event', async () => {
  const db = fakeDb({ a: { ...attempt, completed_at: new Date(Date.now() - 86_400_000).toISOString() } });
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'u1' }),
    { captured: false, reason: 'completion_event_not_fresh' });
  assert.equal(db.inserts.length, 0);
});

test('an old completion with an identical existing snapshot is idempotent', async () => {
  const db = fakeDb({
    a: { ...attempt, completed_at: new Date(Date.now() - 86_400_000).toISOString() },
    s: { ...assignment, verified_at: new Date(Date.now() - 172_800_000).toISOString() },
    snapshot: { attempt_id: 'a1', tenant_institution_id: 't1', evidence_reference: 'verified-onboarding' },
  });
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'u1' }),
    { captured: true, reason: 'already_captured' });
  assert.equal(db.inserts.length, 0);
});

test('concurrent identical snapshot insert is safely idempotent', async () => {
  const db = fakeDb({
    insertError: { code: '23505' },
    concurrentSnapshot: { attempt_id: 'a1', tenant_institution_id: 't1', evidence_reference: 'verified-onboarding' },
  });
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'u1' }),
    { captured: true, reason: 'already_captured' });
});
test('concurrent conflicting snapshot insert fails closed', async () => {
  const db = fakeDb({
    insertError: { code: '23505' },
    concurrentSnapshot: { attempt_id: 'a1', tenant_institution_id: 't2', evidence_reference: 'other' },
  });
  assert.deepEqual(await captureCompletedAssessmentAffiliation({ db, attemptId: 'a1', completedUserId: 'u1' }),
    { captured: false, reason: 'snapshot_concurrent_conflict' });
});
