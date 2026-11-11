import test from 'node:test';
import assert from 'node:assert/strict';
import { planInstitutionalDelivery, reportTypesForMode } from '../lib/institutionalAssessmentDelivery.mjs';

const tenant = 'institution-A';
const settings = { enabled: true, tenant_institution_id: tenant, report_mode: 'both', authorization_reference: 'approved-contract' };
const attempt = { id: 'attempt-1', status: 'completed', completed_at: '2026-11-11T00:00:00Z' };
const recipient = { id: 'recipient-1', tenant_institution_id: tenant, email: 'staff@example.edu', active: true, verified_at: '2026-11-11T00:00:00Z' };
const args = { settings, attempt, studentTenantId: tenant, consentApproved: true, recipients: [recipient] };

test('both mode plans full and summary', () => {
  assert.deepEqual(planInstitutionalDelivery(args).map(x => x.report_type), ['full', 'summary']);
});
test('one report type can be configured', () => {
  assert.deepEqual(reportTypesForMode('summary'), ['summary']);
  assert.equal(planInstitutionalDelivery({ ...args, settings: { ...settings, report_mode: 'summary' } }).length, 1);
});
test('disabled delivery and missing authorization fail closed', () => {
  assert.deepEqual(planInstitutionalDelivery({ ...args, settings: { ...settings, enabled: false } }), []);
  assert.deepEqual(planInstitutionalDelivery({ ...args, settings: { ...settings, authorization_reference: '' } }), []);
  assert.deepEqual(planInstitutionalDelivery({ ...args, consentApproved: false }), []);
});
test('incomplete attempts cannot trigger delivery', () => {
  assert.deepEqual(planInstitutionalDelivery({ ...args, attempt: { ...attempt, status: 'in_progress' } }), []);
});
test('wrong institution and unverified recipients are rejected', () => {
  assert.deepEqual(planInstitutionalDelivery({ ...args, recipients: [{ ...recipient, tenant_institution_id: 'institution-B' }] }), []);
  assert.deepEqual(planInstitutionalDelivery({ ...args, recipients: [{ ...recipient, verified_at: null }] }), []);
});
test('duplicate recipients are not planned twice', () => {
  assert.equal(planInstitutionalDelivery({ ...args, recipients: [recipient, { ...recipient, id: 'recipient-2', email: ' STAFF@example.edu ' }] }).length, 2);
});

test('a completed attempt from a different institution cannot be queued', () => {
  assert.deepEqual(planInstitutionalDelivery({ ...args, studentTenantId: 'institution-B' }), []);
});
test('invalid recipient email is rejected', () => {
  assert.deepEqual(planInstitutionalDelivery({ ...args, recipients: [{ ...recipient, email: 'not-an-email' }] }), []);
});
test('inactive recipient is rejected', () => {
  assert.deepEqual(planInstitutionalDelivery({ ...args, recipients: [{ ...recipient, active: false }] }), []);
});
