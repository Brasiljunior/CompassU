import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstitutionalAssessmentAffiliation } from '../lib/institutionalAssessmentAffiliation.mjs';

function dbWith(data, error = null) {
  return {
    from(table) {
      assert.equal(table, 'institution_assessment_affiliations');
      return {
        select(fields) { assert.equal(fields, 'attempt_id,tenant_institution_id,evidence_reference'); return this; },
        eq(field, id) { assert.equal(field, 'attempt_id'); assert.equal(id, 'attempt-1'); return this; },
        async maybeSingle() { return { data, error }; },
      };
    },
  };
}
test('affiliation lookup rejects missing trusted context', async () => {
  await assert.rejects(resolveInstitutionalAssessmentAffiliation({ db: {}, attemptId: '' }),
    /Missing trusted/);
});
test('affiliation lookup fails closed on missing or incomplete evidence', async () => {
  for (const row of [null, { attempt_id: 'attempt-1', tenant_institution_id: 'tenant-1', evidence_reference: ' ' },
    { attempt_id: 'other', tenant_institution_id: 'tenant-1', evidence_reference: 'source' }]) {
    const result = await resolveInstitutionalAssessmentAffiliation({ db: dbWith(row), attemptId: 'attempt-1' });
    assert.deepEqual(result, { verified: false, reason: 'student_affiliation_not_verified' });
  }
});
test('affiliation lookup returns tenant only when snapshot has evidence', async () => {
  const result = await resolveInstitutionalAssessmentAffiliation({
    db: dbWith({ attempt_id: 'attempt-1', tenant_institution_id: 'tenant-1', evidence_reference: 'invitation-1' }),
    attemptId: 'attempt-1',
  });
  assert.deepEqual(result, { verified: true, tenantInstitutionId: 'tenant-1' });
});
test('affiliation lookup propagates database errors', async () => {
  await assert.rejects(resolveInstitutionalAssessmentAffiliation({
    db: dbWith(null, new Error('db unavailable')), attemptId: 'attempt-1',
  }), /db unavailable/);
});
