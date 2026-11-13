import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueInstitutionalAssessmentDelivery } from '../lib/institutionalAssessmentOutbox.mjs';

function fakeDb(mode) {
  const reads = [];
  const rows = {
    assessment_attempts: { id: 'attempt-1', user_id: 'student-1', status: 'completed', completed_at: '2026-11-12T00:00:00Z' },
    institution_memberships: { id: 'membership-1', active: true, tenant_institution_id: 'tenant-1' },
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
