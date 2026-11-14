import test from 'node:test';
import assert from 'node:assert/strict';
import { captureCompletedAssessmentAffiliation } from '../lib/institutionalCompletionSnapshotCapture.mjs';

const attempt = { id: 'a1', user_id: 'u1', status: 'completed', completed_at: '2026-11-14T10:00:00Z' };
const assignment = { user_id: 'u1', tenant_institution_id: 't1', evidence_reference: 'verified-onboarding', verified_at: '2026-11-14T09:00:00Z' };
function fakeDb({ a = attempt, s = assignment, snapshot = null } = {}) {
  const inserts = [];
  const rows = { assessment_attempts: a, institution_student_assignments: s, institution_assessment_affiliations: snapshot };
  return {
    inserts,
    from(table) {
      let value;
      return {
        select() { return this; },
        eq(_column, v) { value = v; return this; },
        async maybeSingle() { return { data: rows[table], error: null }; },
        async insert(payload) { inserts.push({ table, payload }); return { error: null }; },
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
  const db = fakeDb({ s: { ...assignment, verified_at: '2026-11-14T11:00:00Z' } });
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
