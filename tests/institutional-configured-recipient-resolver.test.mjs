import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfiguredAssessmentRecipients } from '../lib/institutionalConfiguredRecipientResolver.mjs';

const attempt={id:'attempt-1',user_id:'student-1',status:'completed',completed_at:'2026-11-15T17:00:00Z'};
const assignments=[{email:'student@example.edu',institution:'Southwest Tennessee Community College',tenant_institution_id:'tenant-1'}];
const recipients=[{institution:'Southwest Tennessee Community College',email:'representative@example.edu',active:true}];

test('routes completed assessment to recipient of verified home institution',()=>{
 const result=resolveConfiguredAssessmentRecipients({attempt,accountEmail:'STUDENT@example.edu',assignments,recipients});
 assert.equal(result.eligible,true);
 assert.deepEqual(result.recipientEmails,['representative@example.edu']);
 assert.equal(result.tenantInstitutionId,'tenant-1');
});
test('never routes to a different institution',()=>{
 const result=resolveConfiguredAssessmentRecipients({attempt,accountEmail:'student@example.edu',assignments,
 recipients:[{institution:'Other College',email:'other@example.edu',active:true}]});
 assert.deepEqual(result,{eligible:false,reason:'no_active_recipient'});
});
test('rejects incomplete assessment and conflicting tenant assignments',()=>{
 const incomplete=resolveConfiguredAssessmentRecipients({attempt:{...attempt,status:'in_progress'},accountEmail:'student@example.edu',assignments,recipients});
 assert.equal(incomplete.eligible,false);
 const conflicting=resolveConfiguredAssessmentRecipients({attempt,accountEmail:'student@example.edu',assignments:[...assignments,{...assignments[0],tenant_institution_id:'tenant-2'}],recipients});
 assert.equal(conflicting.reason,'ambiguous_or_missing_home_institution');
});
test('ignores inactive recipients and removes duplicates',()=>{
 const result=resolveConfiguredAssessmentRecipients({attempt,accountEmail:'student@example.edu',assignments,
 recipients:[...recipients,{...recipients[0],email:'REPRESENTATIVE@example.edu'},{...recipients[0],email:'inactive@example.edu',active:false}]});
 assert.deepEqual(result.recipientEmails,['representative@example.edu']);
});
