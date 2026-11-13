import test from 'node:test';
import assert from 'node:assert/strict';
import { planInstitutionalDelivery, reportTypesForMode } from '../lib/institutionalAssessmentDelivery.mjs';
import { institutionalReportNotification } from '../lib/institutionalReportNotification.mjs';
import { canViewInstitutionalAssessmentReport } from '../lib/institutionalReportAccess.mjs';
import { canDispatchInstitutionalNotification } from '../lib/institutionalDispatchPolicy.mjs';
import { nextInstitutionalDeliveryRetry } from '../lib/institutionalDeliveryRetry.mjs';
import { sendInstitutionalNotification } from '../lib/institutionalNotificationSender.mjs';
import { createInstitutionalResendTransport } from '../lib/institutionalResendTransport.mjs';
import { validateInstitutionalDeliveryConfiguration, validateInstitutionalRecipientConfiguration } from '../lib/institutionalDeliveryAdminValidation.mjs';

const tenant = 'institution-A';
const settings = { enabled: true, tenant_institution_id: tenant, report_mode: 'summary', authorization_reference: 'approved-contract' };
const attempt = { id: 'attempt-1', status: 'completed', completed_at: '2026-11-11T00:00:00Z' };
const recipient = { id: 'recipient-1', tenant_institution_id: tenant, email: 'staff@example.edu', active: true, verified_at: '2026-11-11T00:00:00Z' };
const args = { settings, attempt, studentTenantId: tenant, consentApproved: true, recipients: [recipient] };

test('unsupported full and mixed modes cannot plan delivery', () => {
  assert.deepEqual(reportTypesForMode('full'), []);
  assert.deepEqual(reportTypesForMode('both'), []);
  assert.deepEqual(planInstitutionalDelivery({ ...args, settings: { ...settings, report_mode: 'full' } }), []);
  assert.deepEqual(planInstitutionalDelivery({ ...args, settings: { ...settings, report_mode: 'both' } }), []);
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
  assert.equal(planInstitutionalDelivery({ ...args, recipients: [recipient, { ...recipient, id: 'recipient-2', email: ' STAFF@example.edu ' }] }).length, 1);
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

test('notification contains no student identifiers or assessment results', () => {
  const notice = institutionalReportNotification({
    institutionName: 'Example College',
    reportType: 'summary',
    portalUrl: 'https://portal.example.edu/institutional-reports',
    allowedPortalOrigins: ['https://portal.example.edu'],
  });
  assert.match(notice.text, /executive summary/);
  assert.match(notice.text, /https:\/\/portal.example.edu/);
  assert.doesNotMatch(notice.text, /attempt-1|recipient-1|staff@example.edu/);
});
test('notification rejects insecure portal links', () => {
  assert.throws(() => institutionalReportNotification({
    institutionName: 'Example College', reportType: 'full', portalUrl: 'http://example.edu/report',
  }));
});

test('notification rejects unapproved origins and query tokens', () => {
  const input = {
    institutionName: 'Example College', reportType: 'summary',
    allowedPortalOrigins: ['https://portal.example.edu'],
  };
  assert.throws(() => institutionalReportNotification({
    ...input, portalUrl: 'https://attacker.example/institutional-reports',
  }));
  assert.throws(() => institutionalReportNotification({
    ...input, portalUrl: 'https://portal.example.edu/institutional-reports?token=secret',
  }));
});

const access = {
  authenticatedUserId: 'staff-user',
  viewerMembership: { user_id: 'staff-user', tenant_institution_id: tenant, active: true },
  designatedRecipient: { id: 'recipient-1', user_id: 'staff-user', email: 'staff@example.edu', tenant_institution_id: tenant, active: true, verified_at: '2026-11-11' },
  deliverySettings: settings,
  authorization: { attempt_id: attempt.id, tenant_institution_id: tenant, approved: true, approved_at: '2026-11-11', revoked_at: null, authorization_reference: 'approved-contract' },
  report: { attempt_id: attempt.id, tenant_institution_id: tenant, recipient_id: 'recipient-1', report_type: 'summary', status: 'sent' },
};
test('verified designated recipient can access own institution report', () => {
  assert.equal(canViewInstitutionalAssessmentReport(access), true);
});
test('cross-institution and undesignated viewers are denied', () => {
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, viewerMembership: { ...access.viewerMembership, tenant_institution_id: 'institution-B' } }), false);
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, designatedRecipient: { ...access.designatedRecipient, user_id: 'another-user' } }), false);
});
test('revoked, unverified and unsent report access is denied', () => {
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, deliverySettings: { ...settings, enabled: false } }), false);
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, designatedRecipient: { ...access.designatedRecipient, verified_at: null } }), false);
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, report: { ...access.report, status: 'queued' } }), false);
});

test('report access fails closed if institutional authorization is withdrawn', () => {
  assert.equal(canViewInstitutionalAssessmentReport({
    ...access,
    deliverySettings: { ...settings, authorization_reference: null },
  }), false);
  assert.equal(canViewInstitutionalAssessmentReport({
    ...access,
    deliverySettings: { ...settings, authorization_reference: '  ' },
  }), false);
});

const dispatch = {
  job: { id: 'job-1', attempt_id: attempt.id, tenant_institution_id: tenant, recipient_id: 'recipient-1', report_type: 'summary', status: 'processing' },
  attempt: { ...attempt, user_id: 'student-user' },
  studentAffiliation: { attempt_id: attempt.id, tenant_institution_id: tenant, evidence_reference: 'trusted-invitation' },
  authorization: { attempt_id: attempt.id, tenant_institution_id: tenant, approved: true, approved_at: '2026-11-11', revoked_at: null, authorization_reference: 'approved-contract' },
  recipient: access.designatedRecipient,
  membership: access.viewerMembership,
  settings,
};
test('dispatch requires fresh active institutional authorization', () => {
  assert.equal(canDispatchInstitutionalNotification(dispatch), true);
  assert.equal(canDispatchInstitutionalNotification({ ...dispatch, settings: { ...settings, enabled: false } }), false);
  assert.equal(canDispatchInstitutionalNotification({ ...dispatch, membership: { ...access.viewerMembership, active: false } }), false);
  assert.equal(canDispatchInstitutionalNotification({ ...dispatch, recipient: { ...access.designatedRecipient, active: false } }), false);
});
test('dispatch refuses queued jobs and mismatched assessments', () => {
  assert.equal(canDispatchInstitutionalNotification({ ...dispatch, job: { ...dispatch.job, status: 'queued' } }), false);
  assert.equal(canDispatchInstitutionalNotification({ ...dispatch, attempt: { ...attempt, id: 'different' } }), false);
});

test('transient delivery errors use bounded retry delays', () => {
  const now = '2026-11-11T00:00:00.000Z';
  assert.equal(nextInstitutionalDeliveryRetry({ retryCount: 0, now }), '2026-11-11T00:15:00.000Z');
  assert.equal(nextInstitutionalDeliveryRetry({ retryCount: 1, now }), '2026-11-11T00:30:00.000Z');
  assert.equal(nextInstitutionalDeliveryRetry({ retryCount: 5, now }), null);
});
test('permanent authorization failures never retry', () => {
  assert.equal(nextInstitutionalDeliveryRetry({ retryCount: 0, errorKind: 'authorization' }), null);
});

test('notification sender confirms accepted provider message', async () => {
  const calls = [];
  const result = await sendInstitutionalNotification({
    ...dispatch,
    institutionName: 'Example College',
    portalUrl: 'https://portal.example.edu/institutional-reports',
    allowedPortalOrigins: ['https://portal.example.edu'],
    fromAddress: 'results@example.edu',
    sendEmail: async (message) => { calls.push(message); return { id: 'provider-message-1' }; },
  });
  assert.deepEqual(result, { status: 'sent', provider_message_id: 'provider-message-1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].idempotencyKey, 'institutional-delivery/job-1');
  assert.deepEqual(calls[0].to, ['staff@example.edu']);
});
test('notification sender never contacts provider after authorization revocation', async () => {
  let sent = false;
  const result = await sendInstitutionalNotification({
    ...dispatch,
    settings: { ...settings, enabled: false },
    sendEmail: async () => { sent = true; return { id: 'unexpected' }; },
  });
  assert.equal(result.status, 'skipped');
  assert.equal(sent, false);
});
test('notification sender refuses missing provider confirmation', async () => {
  await assert.rejects(sendInstitutionalNotification({
    ...dispatch,
    institutionName: 'Example College',
    portalUrl: 'https://portal.example.edu/institutional-reports',
    allowedPortalOrigins: ['https://portal.example.edu'],
    fromAddress: 'results@example.edu',
    sendEmail: async () => ({}),
  }), /did not confirm/);
});

test('notification sender refuses invalid recipient addresses before provider call', async () => {
  let called = false;
  const result = await sendInstitutionalNotification({
    ...dispatch,
    recipient: { ...dispatch.recipient, email: 'invalid-address' },
    fromAddress: 'results@example.edu',
    sendEmail: async () => { called = true; return { id: 'unexpected' }; },
  });
  assert.deepEqual(result, { status: 'skipped', reason: 'invalid_recipient_email' });
  assert.equal(called, false);
});

test('Resend transport forwards idempotency header without report data', async () => {
  let request;
  const sendEmail = createInstitutionalResendTransport({
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ id: 'resend-123' }) };
    },
  });
  const result = await sendEmail({
    from: 'results@example.edu', to: ['staff@example.edu'],
    subject: 'Report available', text: 'Sign in to view your report',
    idempotencyKey: 'institutional-delivery/job-1',
  });
  assert.deepEqual(result, { id: 'resend-123' });
  assert.equal(request.options.headers['Idempotency-Key'], 'institutional-delivery/job-1');
  assert.deepEqual(JSON.parse(request.options.body).to, ['staff@example.edu']);
  assert.doesNotMatch(request.options.body, /attempt-1/);
});
test('Resend transport rejects provider failures and missing confirmation', async () => {
  const message = {
    from: 'results@example.edu', to: ['staff@example.edu'],
    subject: 'Report available', text: 'Sign in', idempotencyKey: 'job-1',
  };
  await assert.rejects(createInstitutionalResendTransport({
    apiKey: 'test-key', fetchImpl: async () => ({ ok: false }),
  })(message), /did not accept/);
  await assert.rejects(createInstitutionalResendTransport({
    apiKey: 'test-key', fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  })(message), /lacked a message identifier/);
});

test('delivery worker refuses jobs without a claim lease', async () => {
  const { processClaimedInstitutionalJob } = await import('../lib/institutionalDeliveryWorker.mjs');
  await assert.rejects(processClaimedInstitutionalJob({
    db: {}, job: { id: 'job-1', status: 'processing' },
  }), /lease timestamp/);
});

test('dispatch refuses missing or mismatched assessment affiliation', () => {
  assert.equal(canDispatchInstitutionalNotification({
    ...dispatch, studentAffiliation: null,
  }), false);
  assert.equal(canDispatchInstitutionalNotification({
    ...dispatch, studentAffiliation: { ...dispatch.studentAffiliation, tenant_institution_id: 'institution-B' },
  }), false);
  assert.equal(canDispatchInstitutionalNotification({
    ...dispatch, studentAffiliation: { ...dispatch.studentAffiliation, evidence_reference: '' },
  }), false);
});

test('dispatch refuses absent or revoked assessment-specific authorization', () => {
  assert.equal(canDispatchInstitutionalNotification({ ...dispatch, authorization: null }), false);
  assert.equal(canDispatchInstitutionalNotification({
    ...dispatch, authorization: { ...dispatch.authorization, revoked_at: '2026-11-12' },
  }), false);
  assert.equal(canDispatchInstitutionalNotification({
    ...dispatch, authorization: { ...dispatch.authorization, attempt_id: 'another-attempt' },
  }), false);
});

test('admin configuration requires evidence before enabling delivery', () => {
  assert.throws(() => validateInstitutionalDeliveryConfiguration({
    enabled: true, report_mode: 'both', authorization_reference: ' ',
  }), /Authorization evidence/);
  assert.deepEqual(validateInstitutionalDeliveryConfiguration({
    enabled: false, report_mode: 'summary', authorization_reference: '',
  }), { enabled: false, report_mode: 'summary', authorization_reference: null });
});
test('admin recipient activation requires verified authenticated identity', () => {
  const user_id = '123e4567-e89b-42d3-a456-426614174000';
  assert.throws(() => validateInstitutionalRecipientConfiguration({
    user_id, email: 'staff@example.edu', active: true, verified_at: null,
  }), /verified/);
  assert.deepEqual(validateInstitutionalRecipientConfiguration({
    user_id, email: ' STAFF@EXAMPLE.EDU ', active: true, verified_at: '2026-11-11',
  }), { user_id, email: 'staff@example.edu', active: true });
});

test('institutional report viewer rejects revoked or wrong-assessment authorization', () => {
  assert.equal(canViewInstitutionalAssessmentReport({
    ...access, authorization: { ...access.authorization, revoked_at: '2026-11-12' },
  }), false);
  assert.equal(canViewInstitutionalAssessmentReport({
    ...access, authorization: { ...access.authorization, attempt_id: 'other-attempt' },
  }), false);
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, authorization: null }), false);
});

test('notification rejects lookalike portal path prefixes', () => {
  assert.throws(() => institutionalReportNotification({
    institutionName: 'Example College', reportType: 'summary',
    portalUrl: 'https://portal.example.edu/institutional-reports-malicious',
    allowedPortalOrigins: ['https://portal.example.edu'],
  }), /Portal URL/);
});

test('retry policy stops after the fifth delivery failure', () => {
  // A job starts with retry_count 0. The fifth failure is terminal.
  const failures = [1, 2, 3, 4, 5];
  const statuses = failures.map(retryCount => {
    const next = retryCount >= 5 ? null : nextInstitutionalDeliveryRetry({
      retryCount: retryCount - 1, now: '2026-11-12T00:00:00Z',
    });
    return next ? 'failed' : 'skipped';
  });
  assert.deepEqual(statuses, ['failed', 'failed', 'failed', 'failed', 'skipped']);
});

test('server report lookup denies unsent jobs without querying report data', async () => {
  const { authorizeInstitutionalReportView } = await import('../lib/institutionalReportLookup.mjs');
  const queries = [];
  const db = { from(table) {
    queries.push(table);
    return { select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: { id: 'job-1', status: 'queued' }, error: null }; } };
  } };
  assert.deepEqual(await authorizeInstitutionalReportView({
    db, authenticatedUserId: 'viewer', jobId: 'job-1',
  }), { allowed: false, reason: 'report_unavailable' });
  assert.deepEqual(queries, ['institution_assessment_delivery_jobs']);
});

test('report lookup denies non-designated viewer before reading authorization', async () => {
  const { authorizeInstitutionalReportView } = await import('../lib/institutionalReportLookup.mjs');
  const tables = [];
  const db = { from(table) {
    tables.push(table);
    return { select() { return this; }, eq() { return this; },
      async maybeSingle() {
        if (table === 'institution_assessment_delivery_jobs') {
          return { data: { id: 'job-1', attempt_id: 'attempt-1', tenant_institution_id: 'institution-A', recipient_id: 'recipient-1', status: 'sent' }, error: null };
        }
        return { data: { id: 'recipient-1', user_id: 'other-user', active: true, verified_at: '2026-11-11', tenant_institution_id: 'institution-A' }, error: null };
      } };
  } };
  const result = await authorizeInstitutionalReportView({
    db, authenticatedUserId: 'unauthorized-user', jobId: 'job-1',
  });
  assert.deepEqual(result, { allowed: false, reason: 'access_denied' });
  assert.deepEqual(tables, ['institution_assessment_delivery_jobs', 'institution_assessment_recipients']);
});

test('worker records a retry when assessment database reads fail', async () => {
  const { processClaimedInstitutionalJob } = await import('../lib/institutionalDeliveryWorker.mjs');
  let recorded = null;
  const db = { from(table) {
    if (table === 'institution_assessment_delivery_jobs') {
      return {
        update(value) { recorded = value; return this; },
        eq() { return this; },
        select() { return this; },
        async maybeSingle() { return { data: { id: 'job-1' }, error: null }; },
      };
    }
    return {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() { return { data: null, error: new Error('database unavailable') }; },
    };
  } };
  const result = await processClaimedInstitutionalJob({
    db, job: { id: 'job-1', status: 'processing', claimed_at: '2026-11-12T00:00:00Z',
      retry_count: 0, attempt_id: 'attempt-1', recipient_id: 'recipient-1', tenant_institution_id: 'institution-A' },
    now: new Date('2026-11-12T01:00:00Z'),
  });
  assert.equal(result.status, 'failed');
  assert.equal(recorded.retry_count, 1);
  assert.equal(recorded.last_error_code, 'transient_delivery_failure');
  assert.equal(recorded.claimed_at, null);
  assert.ok(recorded.next_attempt_at);
});

test('worker quarantines uncertain provider confirmation without retrying', async () => {
  const { processClaimedInstitutionalJob } = await import('../lib/institutionalDeliveryWorker.mjs');
  const job = { id: 'job-1', status: 'processing', claimed_at: '2026-11-12T00:00:00Z',
    retry_count: 0, attempt_id: 'attempt-1', recipient_id: 'recipient-1', tenant_institution_id: 'institution-A', report_type: 'summary' };
  let updated;
  const rows = {
    assessment_attempts: { id: 'attempt-1', user_id: 'student', status: 'completed', completed_at: '2026-11-12' },
    institution_assessment_recipients: { id: 'recipient-1', user_id: 'staff', tenant_institution_id: 'institution-A', email: 'staff@example.edu', active: true, verified_at: '2026-11-11' },
    institution_assessment_delivery_settings: { tenant_institution_id: 'institution-A', enabled: true, report_mode: 'summary', authorization_reference: 'agreement' },
    tenant_institutions: { id: 'institution-A', name: 'Example College' },
    institution_assessment_authorizations: { attempt_id: 'attempt-1', tenant_institution_id: 'institution-A', approved: true, approved_at: '2026-11-11', authorization_reference: 'consent', revoked_at: null },
    institution_assessment_affiliations: { attempt_id: 'attempt-1', tenant_institution_id: 'institution-A', evidence_reference: 'trusted-invitation' },
  };
  const db = { from(table) {
    let queriedUserId = null;
    const q = {
      select() { return this; }, eq(column, value) { if (column === 'user_id') queriedUserId = value; return this; }, limit() { return this; },
      update(value) { updated = value; return this; },
      async maybeSingle() {
        if (table === 'institution_assessment_delivery_jobs') return { data: { id: job.id }, error: null };
        if (table === 'institution_memberships') return { data: { user_id: queriedUserId, tenant_institution_id: 'institution-A', active: true }, error: null };
        return { data: rows[table], error: null };
      },
    };
    return q;
  } };
  const result = await processClaimedInstitutionalJob({
    db, job, fromAddress: 'results@example.edu',
    portalUrl: 'https://portal.example.edu/institutional-reports',
    allowedPortalOrigins: ['https://portal.example.edu'],
    sendEmail: async () => ({}),
    now: new Date('2026-11-12T01:00:00Z'),
  });
  assert.equal(result.status, 'skipped');
  assert.equal(updated.last_error_code, 'provider_confirmation_uncertain');
  assert.equal(updated.next_attempt_at, undefined);
});

test('Resend transport marks network disconnect as uncertain delivery', async () => {
  const sendEmail = createInstitutionalResendTransport({
    apiKey: 'test-key',
    fetchImpl: async () => { throw new Error('connection reset'); },
  });
  await assert.rejects(sendEmail({
    from: 'results@example.edu', to: ['staff@example.edu'],
    subject: 'Report available', text: 'Sign in to view',
    idempotencyKey: 'institutional-delivery/job-1',
  }), /confirmation uncertain/);
});

test('worker never sends when assessment affiliation differs from job institution', async () => {
  const { processClaimedInstitutionalJob } = await import('../lib/institutionalDeliveryWorker.mjs');
  const job = { id: 'job-1', attempt_id: 'attempt-1', recipient_id: 'recipient-1',
    tenant_institution_id: 'institution-A', report_type: 'summary',
    status: 'processing', claimed_at: '2026-11-12T00:00:00Z', retry_count: 0 };
  const records = {
    assessment_attempts: { id: 'attempt-1', user_id: 'student-1', status: 'completed', completed_at: '2026-11-12' },
    institution_assessment_recipients: { id: 'recipient-1', user_id: 'staff-1', tenant_institution_id: 'institution-A',
      email: 'staff@example.edu', active: true, verified_at: '2026-11-12' },
    institution_assessment_delivery_settings: { tenant_institution_id: 'institution-A', enabled: true,
      report_mode: 'summary', authorization_reference: 'agreement' },
    tenant_institutions: { id: 'institution-A', name: 'Example College' },
    institution_assessment_affiliations: { attempt_id: 'attempt-1', tenant_institution_id: 'institution-B',
      evidence_reference: 'verified-invitation' },
    institution_assessment_authorizations: { attempt_id: 'attempt-1', tenant_institution_id: 'institution-A',
      approved: true, approved_at: '2026-11-12', revoked_at: null, authorization_reference: 'consent' },
    institution_memberships: { user_id: 'staff-1', tenant_institution_id: 'institution-A', active: true },
  };
  let update;
  let sent = false;
  const db = { from(table) {
    const q = { select() { return this; }, eq() { return this; }, limit() { return this; },
      update(value) { update = value; return this; },
      async maybeSingle() { return { data: table === 'institution_assessment_delivery_jobs'
        ? { id: job.id } : records[table] ?? null, error: null }; } };
    return q;
  } };
  const result = await processClaimedInstitutionalJob({
    db, job, fromAddress: 'results@example.edu',
    portalUrl: 'https://portal.example.edu/institutional-reports',
    allowedPortalOrigins: ['https://portal.example.edu'],
    sendEmail: async () => { sent = true; return { id: 'should-not-send' }; },
  });
  assert.deepEqual(result, { jobId: 'job-1', status: 'skipped' });
  assert.equal(update.last_error_code, 'authorization_denied');
  assert.equal(sent, false);
});

test('unsupported full and mixed modes cannot authorize institutional report access', () => {
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, report: { ...access.report, report_type: 'full' } }), false);
  assert.equal(canViewInstitutionalAssessmentReport({ ...access, deliverySettings: { ...settings, report_mode: 'both' } }), false);
  assert.throws(() => institutionalReportNotification({
    institutionName: 'Example College', reportType: 'full',
    portalUrl: 'https://portal.example.edu/institutional-reports',
    allowedPortalOrigins: ['https://portal.example.edu'],
  }), /Unsupported report type/);
});

test('admin configuration refuses unimplemented full and mixed report modes', () => {
  for (const report_mode of ['full', 'both']) {
    assert.throws(() => validateInstitutionalDeliveryConfiguration({
      enabled: false, report_mode, authorization_reference: '',
    }), /Invalid report mode/);
  }
});
