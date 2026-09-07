-- CompassU Stage 1: secure institutional analytics service
-- Run in Supabase SQL Editor after review. Creates one SECURITY DEFINER RPC.
-- Institutional scope is derived from account_institutions.email -> auth.users.email.
-- Each student contributes only their latest completed assessment.
-- Aggregate categories with fewer than 5 students are suppressed.

create or replace function public.get_institutional_analytics(p_institution text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_threshold integer := 5;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_compassu_admin() then
    raise exception 'Administrator access required';
  end if;

  with assigned as (
    select u.id as user_id, ai.institution
    from public.account_institutions ai
    join auth.users u on lower(u.email) = lower(ai.email)
    where nullif(trim(ai.institution),'') is not null
      and (p_institution is null or ai.institution = p_institution)
  ),
  latest_completed as (
    select distinct on (a.user_id)
      a.user_id, a.id as attempt_id, a.completed_at
    from public.assessment_attempts a
    join assigned x on x.user_id=a.user_id
    where a.status='completed' and a.completed_at is not null
    order by a.user_id, a.completed_at desc, a.id desc
  ),
  participation as (
    select
      count(distinct x.user_id)::int as assigned_accounts,
      count(distinct case when anya.user_id is not null then x.user_id end)::int as started_students,
      count(distinct lc.user_id)::int as completed_students
    from assigned x
    left join (select distinct user_id from public.assessment_attempts) anya on anya.user_id=x.user_id
    left join latest_completed lc on lc.user_id=x.user_id
  ),
  dimension_student as (
    select lc.user_id, q.dimension,
      avg((((r.response_value->>'value')::numeric - 1.0) / 4.0) * 100.0) as score
    from latest_completed lc
    join public.assessment_responses r on r.attempt_id=lc.attempt_id and r.user_id=lc.user_id
    join public.assessment_questions q on q.id=r.question_id
    where (r.response_value->>'value') ~ '^[1-5]$'
    group by lc.user_id,q.dimension
  ),
  dimension_summary as (
    select dimension, count(*)::int as student_count, round(avg(score),1) as average_score
    from dimension_student group by dimension
  ),
  cluster_student as (
    select lc.user_id, q.scoring_key->>'cluster' as cluster,
      sum(
        case when coalesce((q.scoring_key->>'direction')::numeric,1) < 0
          then (6-(r.response_value->>'value')::numeric) * coalesce((q.scoring_key->>'weight')::numeric,1)
          else (r.response_value->>'value')::numeric * coalesce((q.scoring_key->>'weight')::numeric,1)
        end
      ) / nullif(sum(coalesce((q.scoring_key->>'weight')::numeric,1)),0) as raw_score
    from latest_completed lc
    join public.assessment_responses r on r.attempt_id=lc.attempt_id and r.user_id=lc.user_id
    join public.assessment_questions q on q.id=r.question_id
    where nullif(q.scoring_key->>'cluster','') is not null
      and (r.response_value->>'value') ~ '^[1-5]$'
    group by lc.user_id,q.scoring_key->>'cluster'
  ),
  cluster_top as (
    select *, row_number() over(partition by user_id order by raw_score desc,cluster) as rn
    from cluster_student
  ),
  cluster_distribution as (
    select cluster, count(*)::int as student_count
    from cluster_top where rn=1 group by cluster
  ),
  top_major as (
    select lc.user_id, mm.major_id, mm.match_score, m.name, m.career_cluster
    from latest_completed lc
    join public.major_matches mm on mm.attempt_id=lc.attempt_id and mm.user_id=lc.user_id and mm.rank=1
    join public.majors m on m.id=mm.major_id
  ),
  major_distribution as (
    select major_id,name,career_cluster,count(*)::int as student_count,round(avg(match_score),1) as average_match_score
    from top_major group by major_id,name,career_cluster
  ),
  career_candidates as (
    select tm.user_id,o.id as occupation_id,o.name,o.soc_code,mo.relevance_weight,
      row_number() over(partition by tm.user_id order by mo.relevance_weight desc,o.name) as rn
    from top_major tm
    join public.major_occupations mo on mo.major_id=tm.major_id
    join public.occupations o on o.id=mo.occupation_id
  ),
  career_distribution as (
    select occupation_id,name,soc_code,count(*)::int as student_count
    from career_candidates where rn=1 group by occupation_id,name,soc_code
  ),
  institution_list as (
    select institution,count(*)::int as assigned_accounts
    from assigned group by institution order by institution
  )
  select jsonb_build_object(
    'generated_at', now(),
    'institution', p_institution,
    'privacy', jsonb_build_object('small_cell_threshold',v_threshold,'latest_completed_assessment_only',true),
    'participation', (
      select jsonb_build_object(
        'assigned_accounts',assigned_accounts,
        'started_students',started_students,
        'completed_students',completed_students,
        'not_completed_students',greatest(assigned_accounts-completed_students,0),
        'completion_rate',case when assigned_accounts=0 then 0 else round(completed_students::numeric*100/assigned_accounts,1) end
      ) from participation
    ),
    'dimensions', coalesce((select jsonb_agg(jsonb_build_object('dimension',dimension,'student_count',student_count,'average_score',average_score) order by dimension) from dimension_summary),'[]'::jsonb),
    'career_clusters', coalesce((select jsonb_agg(jsonb_build_object('cluster',cluster,'student_count',student_count,'suppressed',student_count<v_threshold) order by student_count desc,cluster) from cluster_distribution),'[]'::jsonb),
    'top_majors', coalesce((select jsonb_agg(jsonb_build_object('major_id',case when student_count<v_threshold then null else major_id end,'major_name',case when student_count<v_threshold then 'Suppressed' else name end,'career_cluster',case when student_count<v_threshold then null else career_cluster end,'student_count',case when student_count<v_threshold then null else student_count end,'average_match_score',case when student_count<v_threshold then null else average_match_score end,'suppressed',student_count<v_threshold) order by student_count desc,name) from major_distribution),'[]'::jsonb),
    'top_careers', coalesce((select jsonb_agg(jsonb_build_object('occupation_id',case when student_count<v_threshold then null else occupation_id end,'occupation_name',case when student_count<v_threshold then 'Suppressed' else name end,'soc_code',case when student_count<v_threshold then null else soc_code end,'student_count',case when student_count<v_threshold then null else student_count end,'suppressed',student_count<v_threshold) order by student_count desc,name) from career_distribution),'[]'::jsonb),
    'institutions', coalesce((select jsonb_agg(jsonb_build_object('institution',institution,'assigned_accounts',assigned_accounts) order by institution) from institution_list),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_institutional_analytics(text) from public;
grant execute on function public.get_institutional_analytics(text) to authenticated;

comment on function public.get_institutional_analytics(text) is
'CompassU aggregate institutional analytics. Admin-only, latest completed assessment per student, small-cell suppression threshold 5.';

-- Validation examples (run while authenticated through the app/API, not SQL Editor):
-- POST /rest/v1/rpc/get_institutional_analytics {"p_institution": null}
-- POST /rest/v1/rpc/get_institutional_analytics {"p_institution": "Example High School"}
