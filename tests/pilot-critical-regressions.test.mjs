import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../app/admin/page.js', import.meta.url), 'utf8');
const adminInstitutionEnhancer = fs.readFileSync(new URL('../app/admin/AdminInstitutionEnhancer.js', import.meta.url), 'utf8');
const adminVisibleRowRepair = fs.readFileSync(new URL('../app/admin/Admin50kVisibleRowRepair.js', import.meta.url), 'utf8');
const recommendationScope = fs.readFileSync(new URL('../app/api/account/recommendation-scope/route.js', import.meta.url), 'utf8');

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `Missing section start: ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  assert.notEqual(to, -1, `Missing section end: ${end}`);
  return source.slice(from, to);
}

test('classroom login retries only HTTP 429 and caps retry loop', () => {
  const login = section(home, 'async function login()', 'function logout()');
  assert.match(login, /attempt\s*<\s*8/);
  assert.match(login, /response\.status\s*!==\s*429/);
  assert.match(login, /Retry-After/);
  assert.match(login, /large number of students are signing in right now/i);
  assert.match(login, /Math\.min\(waitSeconds,\s*25\)\s*\*\s*1000/);
  assert.match(login, /localStorage\.setItem\(["']compassu_session["']/);
});

test('expired classroom sessions refresh once and persist the rotated tokens', () => {
  const refresh = section(home, 'async function refreshCompassUSession', 'function authHeaders()');
  const api = section(home, 'async function api(', 'const money =');
  assert.match(refresh, /grant_type=refresh_token/);
  assert.match(refresh, /refresh_token:\s*current\.refresh_token/);
  assert.match(refresh, /sessionRefreshPromise/);
  assert.match(refresh, /saveSession\(body\)/);
  assert.match(refresh, /Please sign in again/);
  assert.match(api, /response\.status\s*===\s*401/);
  assert.match(api, /refreshCompassUSession\(getSession\(\),\s*true\)/);
});

test('assessment resume restores persisted responses and first unanswered question', () => {
  const start = section(home, 'async function startAssessment()', 'async function answer(value)');
  assert.match(start, /status=eq\.in_progress/);
  assert.match(start, /assessment_responses\?attempt_id=eq\./);
  assert.match(start, /mapped\[row\.question_id\]\s*=\s*Number\(row\.response_value\.value\)/);
  assert.match(start, /findIndex\(\(?q\)?\s*=>\s*!mapped\[q\.id\]\)/);
});

test('assessment answers are persisted with attempt, user, question, and value', () => {
  const answer = section(home, 'async function answer(value)', 'async function finishAssessment()');
  assert.match(answer, /on_conflict=attempt_id,question_id/);
  assert.match(answer, /attempt_id:\s*attempt\.id/);
  assert.match(answer, /user_id:\s*session\.user\.id/);
  assert.match(answer, /question_id:\s*q\.id/);
  assert.match(answer, /response_value:\s*\{\s*value\s*\}/);
});

test('assessment cannot finalize before 80 answers and uses finalize_assessment RPC', () => {
  const finish = section(home, 'async function finishAssessment()', 'async function loadResults');
  assert.match(finish, /Object\.keys\(answers\)\.length\s*<\s*80/);
  assert.match(finish, /answer all 80 questions/i);
  assert.match(finish, /\/rest\/v1\/rpc\/finalize_assessment/);
  assert.match(finish, /p_attempt_id:\s*attempt\.id/);
  assert.match(finish, /setMatches\(result\)/);
});

test('results reload uses latest completed attempt and existing major matches', () => {
  const results = section(home, 'async function loadResults', 'async function exploreMajor');
  assert.match(results, /status=eq\.completed/);
  assert.match(results, /order=completed_at\.desc&limit=1/);
  assert.match(results, /major_matches\?attempt_id=eq\./);
  assert.match(results, /finalize_assessment/);
  assert.match(results, /setMatches\(rows\.slice\(0,\s*10\)\)/);
});

test('college recommendations are restricted to a configured home institution', () => {
  const explore = section(home, 'async function exploreMajor', 'async function loadFavorites');
  assert.match(explore, /scope\?\.mode\s*===\s*["']home_institution["']/);
  assert.match(explore, /institution_id=eq\.\$\{scope\.institution_id\}/);
  assert.match(explore, /scope\?\.mode\s*===\s*["']unavailable["']/);
  assert.match(recommendationScope, /institutionType\s*===\s*["']high_school["']/);
  assert.match(recommendationScope, /mode:\s*["']home_institution["']/);
  assert.match(recommendationScope, /configured:\s*Boolean\(institutionId\)/);
});

test('administrator API requires an authenticated access token', () => {
  const callAdmin = section(admin, 'const callAdmin=', 'const load=');
  assert.match(callAdmin, /access_token/);
  assert.match(callAdmin, /Administrator login required/);
  assert.match(callAdmin, /\/functions\/v1\/admin-console/);
  assert.match(callAdmin, /Authorization:`Bearer \$\{current\.access_token\}`/);
});

test('account editor identifies the selected account by stable user id', () => {
  assert.match(admin, /data-compassu-account-id=\{u\.id\}/);
  assert.match(adminVisibleRowRepair, /row\.dataset\.compassuAccountId/);
  assert.match(adminInstitutionEnhancer, /accountId\s*=\s*String\(row\.dataset\.compassuAccountId/);
  assert.match(adminInstitutionEnhancer, /user_id:\s*accountId\s*\|\|/);
});

test('bulk deletion requires explicit DELETE confirmation and protects signed-in admin selection', () => {
  const bulk = section(admin, 'const bulkRemoveUsers=', 'const openDetail=');
  assert.match(bulk, /Type DELETE to continue/);
  assert.match(bulk, /answer!==['"]DELETE['"]/);
  assert.match(bulk, /action:'delete_users'/);
  assert.match(bulk, /confirm:'DELETE'/);
  assert.match(bulk, /slice\(i,i\+50\)/);
  assert.match(admin, /user\.id!==session\?\.user\?\.id/);
});

test('batch invitation validation rejects malformed, duplicate, and existing emails', () => {
  const batch = section(admin, 'const parseBatch=', 'const readyBatch=');
  assert.match(batch, /Invalid email/);
  assert.match(batch, /Duplicate in file/);
  assert.match(batch, /Already registered/);
  assert.match(batch, /seen\.has\(email\)/);
  assert.match(batch, /existing\.has\(email\)/);
});
