import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueCompletedInstitutionalAssessment } from '../lib/institutionalCompletionBridge.mjs';

function dbFor({ status = 'completed', affiliation = null, authorization = null } = {}) {
  const reads = [];
  return {
    reads,
    from(table) {
      reads.push(table);
      const rows = {
        assessment_attempts: { id: 'attempt-1', user_id: 'student-1', status,
          completed_at: status === 'completed' ? '2026-11-12T12:00:00Z' : null },
        institution_assessment_affiliations: affiliation,
        institution_assessment_authorizations: authorization,
      };
      if (!(table in rows)) throw new Error('Unexpected table: ' + table);
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: rows[table], error: null }; },
      };
    },
  };
}
test('incomplete assessments do not inspect affiliation or queue', async () => {
  const db = dbFor({ status: 'in_progress' });
  assert.deepEqual(await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' }),
    { queued: 0, reason: 'assessment_not_completed' });
  assert.deepEqual(db.reads, ['assessment_attempts']);
});
test('missing affiliation fails closed without staff membership lookup', async () => {
  const db = dbFor();
  assert.deepEqual(await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' }),
    { queued: 0, reason: 'student_affiliation_not_verified' });
  assert.deepEqual(db.reads, ['assessment_attempts', 'institution_assessment_affiliations']);
});
test('missing trusted completion context is rejected', async () => {
  await assert.rejects(enqueueCompletedInstitutionalAssessment({ attemptId: 'attempt-1' }),
    /Missing or invalid trusted completion context/);
});
test('verified affiliation still requires independent per-attempt consent', async () => {
  const db = dbFor({ affiliation: {
    attempt_id: 'attempt-1', tenant_institution_id: 'tenant-1', evidence_reference: 'invitation-1',
  } });
  assert.deepEqual(await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' }),
    { queued: 0, reason: 'authorization_not_confirmed' });
  assert.equal(db.reads.includes('institution_memberships'), false);
  assert.equal(db.reads.includes('institution_assessment_delivery_jobs'), false);
});
