-- CompassU Stage 1 Institutional Analytics
-- Consolidated Readiness Query
-- Purpose: return ONE exportable result set containing the remaining schema,
-- scoring, policy, and function details needed to build the analytics RPC.
-- READ-ONLY: this script does not create, alter, update, or delete anything.

with
relevant_tables as (
  select unnest(array[
    'profiles',
    'account_institutions',
    'assessment_questions',
    'assessment_attempts',
    'assessment_responses',
    'major_matches',
    'majors',
    'major_occupations',
    'occupations',
    'admin_users'
  ]) as table_name
),
columns_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table_name', c.table_name,
    'ordinal_position', c.ordinal_position,
    'column_name', c.column_name,
    'data_type', c.data_type,
    'udt_name', c.udt_name,
    'is_nullable', c.is_nullable,
    'column_default', c.column_default
  ) order by c.table_name, c.ordinal_position), '[]'::jsonb) as value
  from information_schema.columns c
  join relevant_tables r on r.table_name = c.table_name
  where c.table_schema='public'
),
policies_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table_name', p.tablename,
    'policy_name', p.policyname,
    'permissive', p.permissive,
    'roles', p.roles,
    'command', p.cmd,
    'using_expression', p.qual,
    'with_check_expression', p.with_check
  ) order by p.tablename, p.policyname), '[]'::jsonb) as value
  from pg_policies p
  join relevant_tables r on r.table_name = p.tablename
  where p.schemaname='public'
),
indexes_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table_name', i.tablename,
    'index_name', i.indexname,
    'index_definition', i.indexdef
  ) order by i.tablename, i.indexname), '[]'::jsonb) as value
  from pg_indexes i
  join relevant_tables r on r.table_name = i.tablename
  where i.schemaname='public'
),
foreign_keys_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'constraint_name', tc.constraint_name,
    'table_name', tc.table_name,
    'column_name', kcu.column_name,
    'foreign_table_name', ccu.table_name,
    'foreign_column_name', ccu.column_name
  ) order by tc.table_name, tc.constraint_name), '[]'::jsonb) as value
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.table_schema = tc.table_schema
  where tc.constraint_type='FOREIGN KEY'
    and tc.table_schema='public'
    and tc.table_name in (select table_name from relevant_tables)
),
functions_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema_name', n.nspname,
    'function_name', p.proname,
    'arguments', pg_get_function_arguments(p.oid),
    'result_type', pg_get_function_result(p.oid),
    'language', l.lanname,
    'security_definer', p.prosecdef,
    'volatility', p.provolatile,
    'definition', pg_get_functiondef(p.oid)
  ) order by p.proname), '[]'::jsonb) as value
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='public'
    and p.proname in ('finalize_assessment','get_major_explanation','is_compassu_admin')
),
question_summary_json as (
  select jsonb_build_object(
    'total_active_questions', count(*) filter (where is_active is true),
    'total_questions', count(*),
    'by_dimension', coalesce((
      select jsonb_agg(jsonb_build_object('dimension', dimension, 'question_count', cnt) order by dimension)
      from (
        select dimension, count(*) cnt
        from public.assessment_questions
        group by dimension
      ) d
    ), '[]'::jsonb),
    'scoring_keys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_number', question_number,
        'dimension', dimension,
        'scoring_key', to_jsonb(scoring_key)
      ) order by question_number)
      from public.assessment_questions
    ), '[]'::jsonb)
  ) as value
  from public.assessment_questions
),
attempt_summary_json as (
  select jsonb_build_object(
    'total_attempts', count(*),
    'completed_attempts', count(*) filter (where status='completed'),
    'in_progress_attempts', count(*) filter (where status='in_progress'),
    'unique_users_with_completed_attempt', count(distinct user_id) filter (where status='completed'),
    'latest_completed_at', max(completed_at) filter (where status='completed'),
    'status_breakdown', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', cnt) order by status)
      from (
        select coalesce(status,'<null>') status, count(*) cnt
        from public.assessment_attempts
        group by coalesce(status,'<null>')
      ) s
    ), '[]'::jsonb)
  ) as value
  from public.assessment_attempts
),
response_summary_json as (
  select jsonb_build_object(
    'total_responses', count(*),
    'unique_attempts_with_responses', count(distinct attempt_id),
    'unique_users_with_responses', count(distinct user_id),
    'response_value_samples', coalesce((
      select jsonb_agg(sample_value)
      from (
        select distinct to_jsonb(response_value) sample_value
        from public.assessment_responses
        limit 10
      ) q
    ), '[]'::jsonb)
  ) as value
  from public.assessment_responses
),
major_match_summary_json as (
  select jsonb_build_object(
    'total_major_match_rows', count(*),
    'unique_attempts_with_major_matches', count(distinct attempt_id),
    'unique_majors_matched', count(distinct major_id),
    'rank_min', min(rank),
    'rank_max', max(rank),
    'match_score_min', min(match_score),
    'match_score_max', max(match_score)
  ) as value
  from public.major_matches
),
institution_summary_json as (
  select jsonb_build_object(
    'assignment_rows', count(*),
    'distinct_institutions', count(distinct nullif(trim(institution),'')),
    'blank_institution_rows', count(*) filter (where nullif(trim(institution),'') is null),
    'sample_institutions', coalesce((
      select jsonb_agg(institution order by institution)
      from (
        select distinct trim(institution) institution
        from public.account_institutions
        where nullif(trim(institution),'') is not null
        order by trim(institution)
        limit 25
      ) i
    ), '[]'::jsonb)
  ) as value
  from public.account_institutions
),
table_estimates_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table_name', r.table_name,
    'estimated_rows', coalesce(s.n_live_tup,0),
    'last_analyze', s.last_analyze,
    'last_autoanalyze', s.last_autoanalyze
  ) order by r.table_name), '[]'::jsonb) as value
  from relevant_tables r
  left join pg_stat_user_tables s
    on s.schemaname='public' and s.relname=r.table_name
)
select
  now() as generated_at,
  current_database() as database_name,
  current_schema() as current_schema,
  jsonb_build_object(
    'columns', (select value from columns_json),
    'row_level_security_policies', (select value from policies_json),
    'indexes', (select value from indexes_json),
    'foreign_keys', (select value from foreign_keys_json),
    'function_definitions', (select value from functions_json),
    'assessment_questions', (select value from question_summary_json),
    'assessment_attempts', (select value from attempt_summary_json),
    'assessment_responses', (select value from response_summary_json),
    'major_matches', (select value from major_match_summary_json),
    'institution_assignments', (select value from institution_summary_json),
    'table_estimates', (select value from table_estimates_json)
  ) as analytics_readiness_payload;
