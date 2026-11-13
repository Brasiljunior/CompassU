import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewInstitutionalAssessmentReport } from '../lib/institutionalReportAccess.mjs';

const valid = () => ({
  authenticatedUserId: 'viewer-1',
  viewerMembership: { user_id: 'viewer-1', tenant_institution_id: 'institution-1', active: true },
  designatedRecipient: { id: 'recipient-1', user_id: 'viewer-1', tenant_institution_id: 'institution-1', active: true, verified_at: '2026-11-01' },
  deliverySettings: { tenant_institution_id: 'institution-1', enabled: true, report_mode: 'summary', authorization_reference: 'agreement-1' },
  authorization: { attempt_id: 'attempt-1', tenant_institution_id: 'institution-1', approved: true, approved_at: '2026-11-01', revoked_at: null, authorization_reference: 'consent-1' },
  report: { attempt_id: 'attempt-1', tenant_institution_id: 'institution-1', recipient_id: 'recipient-1', report_type: 'summary', status: 'sent' },
});

test('institutional report access requires complete valid context', () => {
  assert.equal(canViewInstitutionalAssessmentReport(valid()), true);
});

test('revoked consent immediately denies a previously sent report', () => {
  const context = valid();
  context.authorization.revoked_at = '2026-11-12';
  assert.equal(canViewInstitutionalAssessmentReport(context), false);
});

test('recipient deactivation or unverified address denies access', () => {
  const inactive = valid();
  inactive.designatedRecipient.active = false;
  assert.equal(canViewInstitutionalAssessmentReport(inactive), false);
  const unverified = valid();
  unverified.designatedRecipient.verified_at = null;
  assert.equal(canViewInstitutionalAssessmentReport(unverified), false);
});

test('institution mismatch and inactive viewer membership deny access', () => {
  const wrongInstitution = valid();
  wrongInstitution.viewerMembership.tenant_institution_id = 'institution-2';
  assert.equal(canViewInstitutionalAssessmentReport(wrongInstitution), false);
  const inactive = valid();
  inactive.viewerMembership.active = false;
  assert.equal(canViewInstitutionalAssessmentReport(inactive), false);
});

test('disabled institution and changed report mode deny access', () => {
  const disabled = valid();
  disabled.deliverySettings.enabled = false;
  assert.equal(canViewInstitutionalAssessmentReport(disabled), false);
  const changed = valid();
  changed.deliverySettings.report_mode = 'full';
  assert.equal(canViewInstitutionalAssessmentReport(changed), false);
});

test('a report sent to another recipient is inaccessible', () => {
  const context = valid();
  context.report.recipient_id = 'recipient-2';
  assert.equal(canViewInstitutionalAssessmentReport(context), false);
});

test('a report cannot be viewed if its assessment affiliation is missing or changed', async () => {
  const { authorizeInstitutionalReportView } = await import('../lib/institutionalReportLookup.mjs');
  for (const affiliation of [null, {
    attempt_id: 'attempt-1', tenant_institution_id: 'institution-2', evidence_reference: 'verified',
  }, {
    attempt_id: 'attempt-1', tenant_institution_id: 'institution-1', evidence_reference: '',
  }]) {
    const queries = [];
    const records = {
      institution_assessment_delivery_jobs: { id: 'job-1', ...valid().report, status: 'sent' },
      institution_assessment_recipients: valid().designatedRecipient,
      institution_memberships: valid().viewerMembership,
      institution_assessment_delivery_settings: valid().deliverySettings,
      institution_assessment_authorizations: valid().authorization,
      institution_assessment_affiliations: affiliation,
    };
    const db = { from(table) {
      queries.push(table);
      if (!(table in records)) throw new Error('Unexpected table ' + table);
      return {
        select() { return this; }, eq() { return this; }, limit() { return this; },
        async maybeSingle() { return { data: records[table], error: null }; },
      };
    } };
    assert.deepEqual(await authorizeInstitutionalReportView({
      db, authenticatedUserId: 'viewer-1', jobId: 'job-1',
    }), { allowed: false, reason: 'access_denied' });
    assert.equal(queries.includes('institution_assessment_affiliations'), true);
  }
});
