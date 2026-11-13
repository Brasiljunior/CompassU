import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueCompletedInstitutionalAssessment } from '../lib/institutionalCompletionBridge.mjs';

function dbFor({ status = 'completed', memberships = [] } = {}) {
  const reads = [];
  return {
    reads,
    from(table) {
      reads.push(table);
      if (table === 'assessment_attempts') {
        return {
          select() { return this; },
          eq() { return this; },
          async maybeSingle() {
            return { data: { id: 'attempt-1', user_id: 'student-1', status,
              completed_at: status === 'completed' ? '2026-11-12T12:00:00Z' : null }, error: null };
          },
        };
      }
      if (table === 'institution_memberships') {
        return {
          select() { return this; },
          eq() { return this; },
          async then(resolve, reject) { return Promise.resolve({ data: memberships.map(tenant_institution_id => ({ tenant_institution_id })), error: null }).then(resolve, reject); },
        };
      }
      throw new Error('Unexpected institutional outbox access: ' + table);
    },
  };
}

test('incomplete assessments cannot resolve recipients or queue institutional delivery', async () => {
  const db = dbFor({ status: 'in_progress', memberships: ['tenant-1'] });
  assert.deepEqual(await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' }),
    { queued: 0, reason: 'assessment_not_completed' });
  assert.deepEqual(db.reads, ['assessment_attempts']);
});

test('student without active institution membership cannot queue delivery', async () => {
  const db = dbFor();
  assert.deepEqual(await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' }),
    { queued: 0, reason: 'no_institution' });
});

test('student with multiple institutions is not assigned a guessed recipient institution', async () => {
  const db = dbFor({ memberships: ['tenant-1', 'tenant-2'] });
  assert.deepEqual(await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' }),
    { queued: 0, reason: 'ambiguous_institution' });
  assert.deepEqual(db.reads, ['assessment_attempts', 'institution_memberships']);
});

test('missing trusted completion context is rejected', async () => {
  await assert.rejects(enqueueCompletedInstitutionalAssessment({ attemptId: 'attempt-1' }), /Missing trusted/);
});

test('single verified institution delegates to fail-closed delivery settings', async () => {
  const reads = [];
  const db = {
    from(table) {
      reads.push(table);
      const rows = {
        assessment_attempts: { id: 'attempt-1', user_id: 'student-1', status: 'completed', completed_at: '2026-11-12T12:00:00Z' },
        institution_assessment_authorizations: null,
      };
      if (table === 'institution_memberships') {
        return {
          select() { return this; },
          eq() { return this; },
          // Bridge awaits the full membership query; outbox uses limit(1).maybeSingle().
          then(resolve, reject) {
            return Promise.resolve({ data: [{ tenant_institution_id: 'tenant-1' }], error: null }).then(resolve, reject);
          },
          limit() {
            return { async maybeSingle() { return { data: { tenant_institution_id: 'tenant-1', active: true }, error: null }; } };
          },
        };
      }
      if (!(table in rows)) throw new Error('Unexpected table: ' + table);
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: rows[table], error: null }; },
      };
    },
  };
  const result = await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' });
  assert.deepEqual(result, { queued: 0, reason: 'authorization_not_confirmed' });
  assert.equal(reads.includes('institution_assessment_delivery_jobs'), false);
  assert.equal(reads.includes('institution_assessment_recipients'), false);
});

test('repeated memberships do not hide another active institution', async () => {
  const db = dbFor({ memberships: ['tenant-1', 'tenant-1', 'tenant-2'] });
  assert.deepEqual(await enqueueCompletedInstitutionalAssessment({ db, attemptId: 'attempt-1' }),
    { queued: 0, reason: 'ambiguous_institution' });
});
