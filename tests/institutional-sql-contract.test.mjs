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
