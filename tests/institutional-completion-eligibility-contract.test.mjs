import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/institutional-completion-eligibility-staging.sql', import.meta.url), 'utf8');
const gate = readFileSync(new URL('../supabase/institutional-trusted-completion-gate.sql', import.meta.url), 'utf8');

test('eligibility is read-only and uses caller permissions', () => {
  assert.match(sql, /language sql\s+security invoker\s+set search_path = ''\s+stable/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate)\s+(into|from|public\.)/i);
});
test('eligibility validates ownership and unfinished status', () => {
  assert.match(sql, /a\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(sql, /a\.status\s*=\s*'in_progress'/i);
  assert.match(sql, /a\.completed_at\s+is null/i);
});
test('eligibility counts only caller responses and requires 80', () => {
  assert.match(sql, /r\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(sql, /c\.total\s*>=\s*80/i);
});
test('anonymous users cannot execute eligibility RPC', () => {
  assert.match(sql, /revoke all on function public\.institutional_completion_eligibility\(uuid\)\s+from public, anon/i);
  assert.match(sql, /grant execute on function public\.institutional_completion_eligibility\(uuid\)\s+to authenticated/i);
});
test('trusted completion gate rejects client status and owner writes', () => {
  for (const name of ['direct_status_update', 'direct_completion_timestamp_update', 'direct_owner_update']) {
    assert.ok(gate.includes('not ' + name));
  }
  assert.match(gate, /finalize_security_definer is true/i);
});
