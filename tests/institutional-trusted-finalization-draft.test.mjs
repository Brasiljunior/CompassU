import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/institutional-trusted-finalization-cutover-DRAFT.sql',import.meta.url),'utf8');

test('draft requires authenticated caller and owned row lock',()=>{
  assert.match(sql,/v_user uuid := auth\.uid\(\)/);
  assert.match(sql,/v_user is null/);
  assert.match(sql,/a\.id = p_attempt_id and a\.user_id = v_user for update/);
});
test('draft validates response count and preserves scoring output',()=>{
  assert.match(sql,/count\(\*\).*public\.assessment_responses/s);
  assert.match(sql,/< 80 then/);
  assert.match(sql,/public\.score_assessment\(p_attempt_id\)/);
  assert.match(sql,/returns table\(major_id integer, major_name text, match_score numeric, rank integer\)/);
});
test('draft does not accept institution from caller and snapshots only verified assignment',()=>{
  assert.match(sql,/finalize_assessment\(p_attempt_id uuid\)/);
  assert.match(sql,/a\.user_id=v_user/);
  assert.match(sql,/a\.verified_at <= v_completed_at/);
  assert.match(sql,/public\.institution_assessment_affiliations/);
  assert.doesNotMatch(sql,/institution_assessment_delivery_jobs/);
});
test('draft removes broad client attempt writes',()=>{
  assert.match(sql,/revoke insert, update on public\.assessment_attempts from authenticated/i);
  assert.match(sql,/grant insert \(user_id\) on public\.assessment_attempts to authenticated/i);
  assert.doesNotMatch(sql,/grant update .*authenticated/i);
});
test('draft preserves completed-attempt missing-match recovery without new snapshot',()=>{
  assert.match(sql,/elsif not exists \([\s\S]*?public\.major_matches/);
  assert.match(sql,/insert into public\.major_matches/);
});
