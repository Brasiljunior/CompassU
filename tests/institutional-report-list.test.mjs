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
