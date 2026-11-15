import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeInstitutionalAssessmentDelivery } from '../lib/institutionalTrustedFinalization.mjs';

test('trusted completion orchestration rejects missing server-side generator', async () => {
  await assert.rejects(
    finalizeInstitutionalAssessmentDelivery({
      db:{from(){throw new Error('database must not be accessed');}},
      attemptId:'synthetic-attempt',completedUserId:'synthetic-user',
    }),
    /Trusted institutional finalization context required/,
  );
});
test('trusted completion orchestration rejects missing privileged database', async () => {
  await assert.rejects(
    finalizeInstitutionalAssessmentDelivery({
      attemptId:'synthetic-attempt',completedUserId:'synthetic-user',
      generateReport:async()=>{throw new Error('must not generate');},
    }),
    /Trusted institutional finalization context required/,
  );
});
