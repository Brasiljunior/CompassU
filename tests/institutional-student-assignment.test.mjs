import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVerifiedStudentAssignment } from '../lib/institutionalStudentAssignment.mjs';

function fixture(row, error = null) {
  const reads = [];
  return {
    reads,
    from(table) {
      reads.push(table);
      assert.equal(table, 'institution_student_assignments');
      return {
        select(columns) {
          assert.equal(columns, 'user_id,tenant_institution_id,evidence_reference,verified_at');
          return this;
        },
        eq(column, value) {
          assert.equal(column, 'user_id');
          assert.equal(value, 'student-1');
          return this;
        },
        async maybeSingle() { return { data: row, error }; },
      };
    },
  };
}
const valid = {
  user_id: 'student-1',
  tenant_institution_id: 'tenant-1',
  evidence_reference: 'trusted-onboarding-1',
  verified_at: '2026-11-14T12:00:00Z',
};

test('verified assignment resolves only from privileged student assignment table', async () => {
  const db = fixture(valid);
  assert.deepEqual(await resolveVerifiedStudentAssignment({ db, userId: 'student-1' }), {
    verified: true, tenantInstitutionId: 'tenant-1',
    evidenceReference: 'trusted-onboarding-1',
  });
  assert.deepEqual(db.reads, ['institution_student_assignments']);
});

test('missing, mismatched, or unverified assignments fail closed', async () => {
  for (const row of [
    null, { ...valid, user_id: 'other-student' },
    { ...valid, tenant_institution_id: '' },
    { ...valid, evidence_reference: '  ' },
    { ...valid, verified_at: null },
    { ...valid, verified_at: 'not-a-date' },
    { ...valid, verified_at: '2999-01-01T00:00:00Z' },
  ]) {
    const db = fixture(row);
    assert.deepEqual(await resolveVerifiedStudentAssignment({ db, userId: 'student-1' }), {
      verified: false, reason: 'student_assignment_not_verified',
    });
    assert.deepEqual(db.reads, ['institution_student_assignments']);
  }
});

test('database errors are not interpreted as missing consent or a fallback lookup', async () => {
  const failure = new Error('database unavailable');
  await assert.rejects(
    resolveVerifiedStudentAssignment({ db: fixture(null, failure), userId: 'student-1' }),
    /database unavailable/,
  );
});

test('untrusted caller context is rejected before any lookup', async () => {
  await assert.rejects(resolveVerifiedStudentAssignment({ db: fixture(valid), userId: '' }),
    /Missing trusted student assignment context/);
});
