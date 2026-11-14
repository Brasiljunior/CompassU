import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = name => readFileSync(new URL('../supabase/' + name, import.meta.url), 'utf8');

test('affiliation trigger uses valid PostgreSQL dollar-quoted function body', () => {
  const migration = sql('institutional-assessment-affiliation-draft.sql');
  assert.match(migration, /as \$\$\s*begin[\s\S]*?end;\s*\$\$;/i);
  assert.doesNotMatch(migration, /as \$\s*begin/i);
});

test('stale-lease quarantine preserves non-null retry timestamp and never requeues', () => {
  const schema = sql('institutional-assessment-delivery-schema.sql');
  const quarantine = sql('institutional-delivery-stale-lease-quarantine.sql');
  assert.match(schema, /next_attempt_at timestamptz not null/i);
  assert.match(quarantine, /status\s*=\s*'skipped'/i);
  assert.match(quarantine, /next_attempt_at\s*=\s*'infinity'::timestamptz/i);
  assert.doesNotMatch(quarantine, /next_attempt_at\s*=\s*null/i);
});

test('institutional delivery schema starts disabled and requires attempt-level affiliation for jobs and consent', () => {
  const schema = sql('institutional-assessment-delivery-schema.sql');
  const affiliation = sql('institutional-assessment-affiliation-draft.sql');
  assert.match(schema, /enabled boolean not null default false/i);
  assert.match(schema, /active boolean not null default false/i);
  assert.match(schema, /assessment_authorization_affiliation_match[\s\S]*?foreign key \(attempt_id,tenant_institution_id\)[\s\S]*?institution_assessment_affiliations\(attempt_id,tenant_institution_id\)/i);
  assert.match(schema, /delivery_job_affiliation_match[\s\S]*?foreign key \(attempt_id,tenant_institution_id\)[\s\S]*?institution_assessment_affiliations\(attempt_id,tenant_institution_id\)/i);
  assert.match(affiliation, /create unique index if not exists institution_assessment_affiliations_attempt_tenant_key/i);
  for (const table of ['institution_assessment_authorizations', 'institution_assessment_delivery_settings',
    'institution_assessment_recipients', 'institution_assessment_delivery_jobs']) {
    assert.ok(schema.includes('alter table public.' + table + ' enable row level security;'));
    assert.ok(schema.includes('revoke all on public.' + table + ' from anon,authenticated;'));
  }
});

test('database rejects unsupported full-report delivery jobs', () => {
  const schema = sql('institutional-assessment-delivery-schema.sql');
  assert.match(schema, /report_type text not null check \(report_type = 'summary'\)/i);
  assert.doesNotMatch(schema, /report_type text not null check \(report_type in \('full','summary'\)\)/i);
});

test('institutional report API never exposes unsupported report metadata', () => {
  const route = readFileSync(new URL('../app/api/institutional-reports/[jobId]/route.js', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /accessVerified:\s*true/);
  assert.match(route, /result\.reportType === 'summary'/);
  assert.match(route, /status: 404, headers: \{ 'Cache-Control': 'no-store' \}/);
});

test('changing a designated recipient email invalidates verification and deactivates delivery', () => {
  const schema = sql('institutional-assessment-delivery-schema.sql');
  assert.ok(schema.includes('institution_assessment_recipient_email_guard()'));
  assert.match(schema, /create or replace function public\.institution_assessment_recipient_email_guard\(\)[\s\S]*?as \$\$\s*begin[\s\S]*?end;\s*\$\$;/i);
  assert.doesNotMatch(schema, /as \$\s*begin/i);
  assert.ok(schema.includes("language plpgsql security invoker set search_path = ''"));
  assert.ok(schema.includes('revoke all on function public.institution_assessment_recipient_email_guard()'));
  assert.ok(schema.includes('before update of email on public.institution_assessment_recipients'));
  assert.ok(schema.includes('new.verified_at := null;'));
  assert.ok(schema.includes('new.active := false;'));
  assert.ok(schema.includes('pg_catalog.lower(pg_catalog.btrim(new.email)) is distinct from pg_catalog.lower(pg_catalog.btrim(old.email))'));
});

test('draft student assignment remains privileged and never backfills from mutable identities', () => {
  const draft = sql('institutional-student-assignment-design.sql');
  assert.match(draft, /create table if not exists public\.institution_student_assignments/i);
  assert.match(draft, /user_id uuid primary key references auth\.users\(id\)/i);
  assert.match(draft, /tenant_institution_id uuid not null references public\.tenant_institutions\(id\)/i);
  assert.match(draft, /evidence_reference text not null/i);
  assert.match(draft, /verified_at timestamptz not null/i);
  assert.match(draft, /alter table public\.institution_student_assignments enable row level security/i);
  assert.match(draft, /revoke all on public\.institution_student_assignments from anon, authenticated/i);
  assert.doesNotMatch(draft, /insert\s+into\s+public\.institution_student_assignments\s+select/i);
  assert.doesNotMatch(draft, /create\s+trigger\s+\w+\s+(before|after)\s+update\s+on\s+public\.assessment_attempts/i);
  assert.match(draft, /security invoker set search_path = ''/i);
  assert.match(draft, /revoke all on function public\.capture_institution_assessment_affiliation\(\)/i);
});

test('phase two readiness report is read-only and checks every institutional delivery table', () => {
  const report = sql('institutional-delivery-phase2-readiness.sql');
  for (const table of ['institution_assessment_affiliations','institution_assessment_delivery_settings',
    'institution_assessment_recipients','institution_assessment_authorizations',
    'institution_assessment_delivery_jobs']) {
    assert.ok(report.includes("to_regclass('public." + table + "')"));
  }
  assert.doesNotMatch(report, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\s/mi);
});

test('verified student assignment cannot be silently reassigned', () => {
  const draft = sql('institutional-student-assignment-design.sql');
  assert.match(draft, /create or replace function public\.prevent_institution_student_assignment_update\(\)/i);
  assert.match(draft, /before update on public\.institution_student_assignments/i);
  assert.match(draft, /raise exception 'Verified institutional student assignment is immutable'/i);
  assert.match(draft, /revoke all on function public\.prevent_institution_student_assignment_update\(\)/i);
});
