import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueInstitutionalAssessmentDelivery } from '../lib/institutionalAssessmentOutbox.mjs';

function fakeDb(mode) {
  const reads = [];
  const rows = {
    assessment_attempts: { id: 'attempt-1', user_id: 'student-1', status: 'completed', completed_at: '2026-11-12T00:00:00Z' },
    institution_assessment_affiliations: { attempt_id: 'attempt-1', tenant_institution_id: 'tenant-1', evidence_reference: 'invitation-1' },
    institution_assessment_authorizations: {
      attempt_id: 'attempt-1', tenant_institution_id: 'tenant-1',
      approved: true, approved_at: '2026-11-12T00:00:00Z',
      revoked_at: null, authorization_reference: 'recorded-consent',
    },
    institution_assessment_delivery_settings: {
      tenant_institution_id: 'tenant-1', enabled: true,
      report_mode: mode, authorization_reference: 'agreement',
    },
  };
  const db = {
    reads,
    from(table) {
      reads.push(table);
      if (table === 'institution_assessment_recipients' || table === 'institution_assessment_delivery_jobs') {
        throw new Error('Must not read recipients or write jobs for unsupported report mode');
      }
      const chain = {
        select() { return this; },
        eq() { return this; },
        limit() { return this; },
        async maybeSingle() { return { data: rows[table], error: null }; },
      };
      return chain;
    },
  };
  return db;
}

for (const mode of ['full', 'both']) {
  test('outbox refuses unsupported ' + mode + ' report mode before reading recipients', async () => {
    const db = fakeDb(mode);
    const result = await enqueueInstitutionalAssessmentDelivery({
      db, attemptId: 'attempt-1', studentTenantId: 'tenant-1',
    });
    assert.deepEqual(result, { queued: 0, reason: 'report_mode_not_supported_yet' });
    assert.equal(db.reads.includes('institution_assessment_recipients'), false);
    assert.equal(db.reads.includes('institution_assessment_delivery_jobs'), false);
  });
}

test('outbox refuses a tenant inconsistent with the assessment affiliation before consent lookup', async () => {
  const db = fakeDb('summary');
  const result = await enqueueInstitutionalAssessmentDelivery({
    db, attemptId: 'attempt-1', studentTenantId: 'different-tenant',
  });
  assert.deepEqual(result, { queued: 0, reason: 'institution_mismatch' });
  assert.deepEqual(db.reads, ['assessment_attempts', 'institution_assessment_affiliations']);
});

test('outbox rejects incomplete institutional affiliation evidence before consent lookup', async () => {
  const db = fakeDb('summary');
  const originalFrom = db.from;
  db.from = function (table) {
    if (table === 'institution_assessment_affiliations') {
      db.reads.push(table);
      return { select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: { attempt_id: 'attempt-1', tenant_institution_id: 'tenant-1', evidence_reference: '' }, error: null }; } };
    }
    return originalFrom(table);
  };
  const result = await enqueueInstitutionalAssessmentDelivery({
    db, attemptId: 'attempt-1', studentTenantId: 'tenant-1',
  });
  assert.deepEqual(result, { queued: 0, reason: 'student_affiliation_not_verified' });
  assert.equal(db.reads.includes('institution_assessment_authorizations'), false);
});
