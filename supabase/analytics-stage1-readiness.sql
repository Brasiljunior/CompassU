-- CompassU Institutional Analytics — Stage 1 Readiness / Schema Inventory
-- READ-ONLY. This script does not create, alter, or delete database objects.
-- Run in the Supabase SQL Editor and preserve the result sets for Stage 1 implementation.

-- 1) Source-table column inventory
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles',
    'account_institutions',
    'assessment_questions',
    'assessment_attempts',
    'assessment_responses',
    'major_matches',
    'majors',
    'major_occupations',
    'occupations'
  )
order by table_name, ordinal_position;

-- 2) Confirm whether additional likely analytics/recommendation tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name ilike '%career%'
    or table_name ilike '%cluster%'
    or table_name ilike '%score%'
    or table_name ilike '%match%'
    or table_name ilike '%institution%'
    or table_name ilike '%assessment%'
  )
order by table_name;

-- 3) Index inventory for high-volume analytics paths
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles',
    'account_institutions',
    'assessment_questions',
    'assessment_attempts',
    'assessment_responses',
    'major_matches',
    'major_occupations'
  )
order by tablename, indexname;

-- 4) RLS status
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'account_institutions',
    'assessment_questions',
    'assessment_attempts',
    'assessment_responses',
    'major_matches',
    'majors',
    'major_occupations',
    'occupations'
  )
order by c.relname;

-- 5) RLS policy inventory
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'account_institutions',
    'assessment_questions',
    'assessment_attempts',
    'assessment_responses',
    'major_matches',
    'majors',
    'major_occupations',
    'occupations'
  )
order by tablename, policyname;

-- 6) Exact assessment scoring-key shape examples.
-- Results should be reviewed before any cluster analytics RPC is written.
select
  question_number,
  dimension,
  scoring_key
from public.assessment_questions
where is_active = true
order by question_number
limit 20;

-- 7) Distinct scoring-key structures, represented as JSON key lists where possible.
select distinct
  case
    when jsonb_typeof(scoring_key::jsonb) = 'object'
      then (select string_agg(key, ', ' order by key) from jsonb_object_keys(scoring_key::jsonb) key)
    else jsonb_typeof(scoring_key::jsonb)
  end as scoring_key_shape
from public.assessment_questions
where scoring_key is not null;

-- 8) Assessment-attempt status distribution and data volume
select
  status,
  count(*) as attempt_count,
  min(started_at) as earliest_started_at,
  max(started_at) as latest_started_at,
  min(completed_at) as earliest_completed_at,
  max(completed_at) as latest_completed_at
from public.assessment_attempts
group by status
order by status;

-- 9) Response data-volume and JSON response examples
select
  count(*) as response_rows,
  count(distinct attempt_id) as attempts_with_responses,
  count(distinct user_id) as users_with_responses
from public.assessment_responses;

select
  response_value,
  count(*) as row_count
from public.assessment_responses
group by response_value
order by row_count desc
limit 10;

-- 10) Major-match volume and rank distribution
select
  rank,
  count(*) as match_rows,
  count(distinct attempt_id) as attempts
from public.major_matches
group by rank
order by rank;

-- 11) Identify completed attempts that do not have major matches
select count(*) as completed_attempts_without_major_matches
from public.assessment_attempts a
where a.status = 'completed'
  and not exists (
    select 1
    from public.major_matches mm
    where mm.attempt_id = a.id
  );

-- 12) Institution assignment coverage.
-- `account_institutions` is currently keyed by email, while attempts are keyed by user_id.
select
  count(*) as institution_assignments,
  count(distinct lower(email)) as distinct_assigned_emails,
  count(distinct nullif(trim(institution), '')) as distinct_institutions
from public.account_institutions;

-- 13) Current institution names and assigned-account counts.
-- No student names or response data are returned.
select
  institution,
  count(*) as assigned_accounts
from public.account_institutions
where nullif(trim(institution), '') is not null
group by institution
order by assigned_accounts desc, institution;

-- 14) Function inventory for assessment/admin/analytics-related PostgreSQL routines
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%assessment%'
    or p.proname ilike '%major%'
    or p.proname ilike '%career%'
    or p.proname ilike '%admin%'
    or p.proname ilike '%analytics%'
  )
order by p.proname;

-- 15) Exact definitions of known scoring/admin helper functions, if present.
-- This is read-only metadata inspection.
select
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'finalize_assessment',
    'get_major_explanation',
    'is_compassu_admin'
  )
order by p.proname;

-- 16) Foreign-key relationships among analytics source tables
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.constraint_schema = kcu.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.constraint_schema = tc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.constraint_schema = 'public'
  and tc.table_name in (
    'profiles',
    'account_institutions',
    'assessment_attempts',
    'assessment_responses',
    'major_matches',
    'major_occupations'
  )
order by tc.table_name, kcu.column_name;

-- End of read-only Stage 1 readiness script.
