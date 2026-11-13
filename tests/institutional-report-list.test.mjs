import test from 'node:test';
import assert from 'node:assert/strict';
import { listAuthorizedInstitutionalReports } from '../lib/institutionalReportList.mjs';

function fakeDb({ recipients = [], jobs = [], records = {}, errorTable = null } = {}) {
  return {
    from(table) {
      const filters = [];
      const q = {
        select() { return this; },
        eq(k, v) { filters.push([k, v]); return this; },
        not() { return this; },
        in(k, v) { filters.push([k, v]); return this; },
        order() { return this; },
        limit() { return this; },
        async maybeSingle() {
          if (table === errorTable) return { data: null, error: new Error('query failed') };
          const key = filters.find(([k]) => k === 'id')?.[1];
          const value = records[table];
          if (table === 'institution_assessment_delivery_jobs') {
            return { data: jobs.find(x => x.id === key) || null, error: null };
          }
          return { data: value ?? null, error: null };
        },
        then(resolve) {
          const data = table === 'institution_assessment_recipients' ? recipients : jobs;
          resolve(table === errorTable ? { data: null, error: new Error('query failed') } : { data, error: null });
        },
      };
      return q;
    },
  };
}

test('report list requires a verified recipient', async () => {
  const result = await listAuthorizedInstitutionalReports({
    db: fakeDb(), authenticatedUserId: 'viewer',
  });
  assert.deepEqual(result, []);
});

test('report list rejects invalid page sizes', async () => {
  await assert.rejects(listAuthorizedInstitutionalReports({
    db: fakeDb(), authenticatedUserId: 'viewer', limit: 101,
  }), /Invalid report list limit/);
});

test('report list does not leak sent report metadata without valid authorization', async () => {
  const db = fakeDb({
    recipients: [{ id: 'recipient', tenant_institution_id: 'tenant' }],
    jobs: [{ id: 'job', status: 'sent', recipient_id: 'recipient', report_type: 'summary', sent_at: '2026-11-12' }],
  });
  assert.deepEqual(await listAuthorizedInstitutionalReports({
    db, authenticatedUserId: 'viewer',
  }), []);
});

test('report list fails on recipient lookup errors instead of claiming no records', async () => {
  await assert.rejects(listAuthorizedInstitutionalReports({
    db: fakeDb({ errorTable: 'institution_assessment_recipients' }), authenticatedUserId: 'viewer',
  }), /query failed/);
});


function authorizedDb({ revoked = false, recipientActive = true } = {}) {
  const tenant = 'tenant-A', viewer = 'viewer-A', jobId = 'job-A', attemptId = 'attempt-A';
  const rows = {
    institution_assessment_recipients: [{ id: 'recipient-A', user_id: viewer, tenant_institution_id: tenant, active: recipientActive, verified_at: '2026-11-11' }],
    institution_assessment_delivery_jobs: [{ id: jobId, attempt_id: attemptId, tenant_institution_id: tenant, recipient_id: 'recipient-A', report_type: 'summary', status: 'sent', sent_at: '2026-11-12' }],
    institution_memberships: [
      { user_id: viewer, tenant_institution_id: tenant, active: true },
      { user_id: 'student-A', tenant_institution_id: tenant, active: true },
    ],
    institution_assessment_delivery_settings: [{ tenant_institution_id: tenant, enabled: true, report_mode: 'summary', authorization_reference: 'institution-agreement' }],
    institution_assessment_authorizations: [{ attempt_id: attemptId, tenant_institution_id: tenant, approved: !revoked, approved_at: '2026-11-11', authorization_reference: 'student-consent', revoked_at: revoked ? '2026-11-12' : null }],
    institution_assessment_affiliations: [{ attempt_id: attemptId, tenant_institution_id: tenant, evidence_reference: 'trusted-invitation' }],
  };
  return {
    from(table) {
      const filters = [];
      const query = {
        select() { return this; },
        eq(key, value) { filters.push(row => row[key] === value); return this; },
        in(key, values) { filters.push(row => values.includes(row[key])); return this; },
        not(key, op, value) { if (op === 'is' && value === null) filters.push(row => row[key] != null); return this; },
        order() { return this; },
        limit() { return this; },
        async maybeSingle() {
          const matching = (rows[table] || []).filter(row => filters.every(fn => fn(row)));
          return { data: matching[0] || null, error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({ data: (rows[table] || []).filter(row => filters.every(fn => fn(row))), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test('authorized recipient sees only report metadata and no student identifiers', async () => {
  const reports = await listAuthorizedInstitutionalReports({
    db: authorizedDb(), authenticatedUserId: 'viewer-A',
  });
  assert.deepEqual(reports, [{
    id: 'job-A', type: 'summary', sentAt: '2026-11-12', contentAvailable: true,
  }]);
  assert.equal(JSON.stringify(reports).includes('student-A'), false);
});

test('revoking individual assessment authorization immediately removes report listing', async () => {
  const reports = await listAuthorizedInstitutionalReports({
    db: authorizedDb({ revoked: true }), authenticatedUserId: 'viewer-A',
  });
  assert.deepEqual(reports, []);
});

test('deactivating a designated recipient removes their report listing', async () => {
  const reports = await listAuthorizedInstitutionalReports({
    db: authorizedDb({ recipientActive: false }), authenticatedUserId: 'viewer-A',
  });
  assert.deepEqual(reports, []);
});
