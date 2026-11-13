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
