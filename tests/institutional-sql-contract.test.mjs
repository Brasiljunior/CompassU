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
  assert.match(schema, /assessment_authorization_affiliation_match[\\s\\S]*?foreign key \\(attempt_id,tenant_institution_id\\)[\\s\\S]*?institution_assessment_affiliations\\(attempt_id,tenant_institution_id\\)/i);
  assert.match(schema, /delivery_job_affiliation_match[\\s\\S]*?foreign key \\(attempt_id,tenant_institution_id\\)[\\s\\S]*?institution_assessment_affiliations\\(attempt_id,tenant_institution_id\\)/i);
  assert.match(affiliation, /create unique index if not exists institution_assessment_affiliations_attempt_tenant_key/i);
  for (const table of ['institution_assessment_authorizations', 'institution_assessment_delivery_settings',
    'institution_assessment_recipients', 'institution_assessment_delivery_jobs']) {
    assert.ok(schema.includes('alter table public.' + table + ' enable row level security;'));
    assert.ok(schema.includes('revoke all on public.' + table + ' from anon,authenticated;'));
  }
});
