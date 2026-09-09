-- CompassU Stage 2E-C: secure automated monthly reporting scheduler support
-- Install after Stage 2E foundation/delivery SQL and Stage 2A/2C analytics SQL.
-- This patch keeps normal Master Administrator behavior unchanged while allowing
-- Supabase service_role (server only) to execute the two aggregate reporting RPCs.
-- It also exposes scheduler-only profile, duplicate-check, and delivery-log RPCs.

-- 1) Stage 2A analytics: preserve existing logic/privacy, add service_role authorization.
create or replace function public.get_institutional_analytics_v2(
  p_institution text default null,
  p_start_date date default null,
  p_end_date date default null
)
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
  if coalesce(auth.role(),'') <> 'service_role'
     and (auth.uid() is null or not public.is_compassu_admin()) then
    raise exception 'Administrator access required';
  end if;
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'Start date cannot be after end date';
  end if;

  with assigned as (
    select u.id as user_id, ai.institution
    from public.account_institutions ai
    join auth.users u on lower(u.email)=lower(ai.email)
    where nullif(trim(ai.institution),'') is not null
      and (p_institution is null or ai.institution=p_institution)
  ),
  latest_completed_overall as (
    select distinct on (a.user_id) a.user_id,a.id as attempt_id,a.completed_at
    from public.assessment_attempts a
    join assigned x on x.user_id=a.user_id
    where a.status='completed' and a.completed_at is not null
    order by a.user_id,a.completed_at desc,a.id desc
  ),
  latest_completed as (
    select * from latest_completed_overall
    where (p_start_date is null or completed_at >= p_start_date::timestamptz)
      and (p_end_date is null or completed_at < (p_end_date+1)::timestamptz)
  ),
  started_in_period as (
    select distinct a.user_id
    from public.assessment_attempts a join assigned x on x.user_id=a.user_id
    where (p_start_date is null or a.started_at >= p_start_date::timestamptz)
      and (p_end_date is null or a.started_at < (p_end_date+1)::timestamptz)
  ),
  participation as (
    select count(distinct x.user_id)::int assigned_accounts,
      count(distinct sip.user_id)::int started_students,
      count(distinct lc.user_id)::int completed_students
    from assigned x
    left join started_in_period sip on sip.user_id=x.user_id
    left join latest_completed lc on lc.user_id=x.user_id
  ),
  dimension_student as (
    select lc.user_id,q.dimension,avg((((r.response_value->>'value')::numeric-1)/4)*100) score
    from latest_completed lc
    join public.assessment_responses r on r.attempt_id=lc.attempt_id and r.user_id=lc.user_id
    join public.assessment_questions q on q.id=r.question_id
    where (r.response_value->>'value') ~ '^[1-5]$'
    group by lc.user_id,q.dimension
  ),
  dimension_summary as (
    select dimension,count(*)::int student_count,round(avg(score),1) average_score from dimension_student group by dimension
  ),
  cluster_student as (
    select lc.user_id,q.scoring_key->>'cluster' cluster,
      sum(case when coalesce((q.scoring_key->>'direction')::numeric,1)<0
        then (6-(r.response_value->>'value')::numeric)*coalesce((q.scoring_key->>'weight')::numeric,1)
        else (r.response_value->>'value')::numeric*coalesce((q.scoring_key->>'weight')::numeric,1) end)
      /nullif(sum(coalesce((q.scoring_key->>'weight')::numeric,1)),0) raw_score
    from latest_completed lc
    join public.assessment_responses r on r.attempt_id=lc.attempt_id and r.user_id=lc.user_id
    join public.assessment_questions q on q.id=r.question_id
    where nullif(q.scoring_key->>'cluster','') is not null and (r.response_value->>'value') ~ '^[1-5]$'
    group by lc.user_id,q.scoring_key->>'cluster'
  ),
  cluster_top as (
    select *,row_number() over(partition by user_id order by raw_score desc,cluster) rn from cluster_student
  ),
  cluster_distribution as (
    select cluster,count(*)::int student_count from cluster_top where rn=1 group by cluster
  ),
  student_major_recommendations as (
    select distinct lc.user_id,mm.major_id,m.name,m.career_cluster,mm.match_score,mm.rank
    from latest_completed lc
    join public.major_matches mm on mm.attempt_id=lc.attempt_id and mm.user_id=lc.user_id and mm.rank between 1 and 10
    join public.majors m on m.id=mm.major_id
  ),
  major_distribution as (
    select major_id,name,career_cluster,count(distinct user_id)::int student_count,
      round(avg(match_score),1) average_match_score,round(avg(rank),1) average_rank
    from student_major_recommendations group by major_id,name,career_cluster
  ),
  student_career_candidates as (
    select smr.user_id,o.id occupation_id,o.name,o.soc_code,
      row_number() over(partition by smr.user_id,o.id order by smr.rank asc,mo.relevance_weight desc,o.name) occupation_dedupe_rank
    from student_major_recommendations smr
    join public.major_occupations mo on mo.major_id=smr.major_id
    join public.occupations o on o.id=mo.occupation_id
    where smr.rank between 1 and 3
  ),
  career_distribution as (
    select occupation_id,name,soc_code,count(distinct user_id)::int student_count
    from student_career_candidates where occupation_dedupe_rank=1 group by occupation_id,name,soc_code
  ),
  institution_list as (
    select institution,count(*)::int assigned_accounts from assigned group by institution order by institution
  )
  select jsonb_build_object(
    'generated_at',now(),'institution',p_institution,
    'reporting_period',jsonb_build_object('start_date',p_start_date,'end_date',p_end_date,'filtered',p_start_date is not null or p_end_date is not null),
    'privacy',jsonb_build_object('small_cell_threshold',v_threshold,'latest_completed_assessment_only',true,'major_method','top_10_recommendation_frequency','career_method','career_frequency_from_top_3_majors'),
    'participation',(select jsonb_build_object('assigned_accounts',assigned_accounts,'started_students',started_students,'completed_students',completed_students,'not_completed_students',greatest(assigned_accounts-completed_students,0),'completion_rate',case when assigned_accounts=0 then 0 else round(completed_students::numeric*100/assigned_accounts,1) end) from participation),
    'dimensions',coalesce((select jsonb_agg(jsonb_build_object('dimension',dimension,'student_count',case when student_count<v_threshold then null else student_count end,'average_score',case when student_count<v_threshold then null else average_score end,'suppressed',student_count<v_threshold) order by dimension) from dimension_summary),'[]'::jsonb),
    'career_clusters',coalesce((select jsonb_agg(jsonb_build_object('cluster',case when student_count<v_threshold then 'Suppressed' else cluster end,'student_count',case when student_count<v_threshold then null else student_count end,'suppressed',student_count<v_threshold) order by student_count desc,cluster) from cluster_distribution),'[]'::jsonb),
    'top_majors',coalesce((select jsonb_agg(jsonb_build_object('major_id',case when student_count<v_threshold then null else major_id end,'major_name',case when student_count<v_threshold then 'Suppressed' else name end,'career_cluster',case when student_count<v_threshold then null else career_cluster end,'student_count',case when student_count<v_threshold then null else student_count end,'average_match_score',case when student_count<v_threshold then null else average_match_score end,'average_rank',case when student_count<v_threshold then null else average_rank end,'suppressed',student_count<v_threshold) order by student_count desc,name) from major_distribution),'[]'::jsonb),
    'top_careers',coalesce((select jsonb_agg(jsonb_build_object('occupation_id',case when student_count<v_threshold then null else occupation_id end,'occupation_name',case when student_count<v_threshold then 'Suppressed' else name end,'soc_code',case when student_count<v_threshold then null else soc_code end,'student_count',case when student_count<v_threshold then null else student_count end,'suppressed',student_count<v_threshold) order by student_count desc,name) from career_distribution),'[]'::jsonb),
    'institutions',coalesce((select jsonb_agg(jsonb_build_object('institution',institution,'assigned_accounts',assigned_accounts) order by institution) from institution_list),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_institutional_analytics_v2(text,date,date) from public;
grant execute on function public.get_institutional_analytics_v2(text,date,date) to authenticated, service_role;

-- 2) Stage 2C trends: preserve existing logic, add service_role authorization.
create or replace function public.get_institutional_trends(
  p_institution text default null,
  p_period_months integer default 12,
  p_period_count integer default 4,
  p_end_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_threshold integer := 5;
  v_rows jsonb := '[]'::jsonb;
  v_i integer;
  v_period_end date;
  v_period_start date;
  v_item jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role'
     and (auth.uid() is null or not public.is_compassu_admin()) then
    raise exception 'Administrator access required';
  end if;
  if p_period_months < 1 or p_period_months > 60 then
    raise exception 'Period months must be between 1 and 60';
  end if;
  if p_period_count < 2 or p_period_count > 12 then
    raise exception 'Period count must be between 2 and 12';
  end if;

  for v_i in reverse p_period_count-1..0 loop
    v_period_end := (p_end_date - make_interval(months => v_i * p_period_months))::date;
    v_period_start := (v_period_end - make_interval(months => p_period_months) + interval '1 day')::date;
    v_item := public.get_institutional_analytics_v2(p_institution,v_period_start,v_period_end);
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'period_start',v_period_start,
      'period_end',v_period_end,
      'participation',v_item->'participation',
      'dimensions',v_item->'dimensions',
      'career_clusters',v_item->'career_clusters',
      'top_majors',v_item->'top_majors',
      'top_careers',v_item->'top_careers'
    ));
  end loop;

  return jsonb_build_object(
    'generated_at',now(),
    'institution',p_institution,
    'period_months',p_period_months,
    'period_count',p_period_count,
    'through_date',p_end_date,
    'privacy',jsonb_build_object(
      'small_cell_threshold',v_threshold,
      'aggregate_only',true,
      'latest_completed_assessment_only',true
    ),
    'periods',v_rows
  );
end;
$$;

revoke all on function public.get_institutional_trends(text,integer,integer,date) from public;
grant execute on function public.get_institutional_trends(text,integer,integer,date) to authenticated, service_role;

-- 3) Scheduler-only profile reader.
create or replace function public.get_monthly_reporting_profiles_for_service()
returns setof public.institution_reporting_profiles
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
    select p.*
    from public.institution_reporting_profiles p
    where p.active=true
    order by p.institution;
end;
$$;

revoke all on function public.get_monthly_reporting_profiles_for_service() from public, anon, authenticated;
grant execute on function public.get_monthly_reporting_profiles_for_service() to service_role;

-- 4) Duplicate-delivery guard. A successful delivery for the same profile/month blocks auto-resend.
create or replace function public.has_successful_monthly_report_delivery_service(
  p_reporting_profile_id uuid,
  p_reporting_period_start date
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return exists(
    select 1
    from public.institution_report_delivery_log l
    where l.reporting_profile_id=p_reporting_profile_id
      and l.reporting_period_start=p_reporting_period_start
      and l.status='sent'
  );
end;
$$;

revoke all on function public.has_successful_monthly_report_delivery_service(uuid,date) from public, anon, authenticated;
grant execute on function public.has_successful_monthly_report_delivery_service(uuid,date) to service_role;

-- 5) Scheduler-only delivery logger. Manual Master Admin logger remains unchanged.
create or replace function public.record_monthly_report_delivery_service(
  p_reporting_profile_id uuid,
  p_institution text,
  p_reporting_period_start date,
  p_reporting_period_end date,
  p_recipient_emails text[],
  p_status text,
  p_provider_message_id text default null,
  p_error_message text default null
)
returns public.institution_report_delivery_log
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_attempt integer;
  v_row public.institution_report_delivery_log;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_status not in ('scheduled','generating','sent','failed','skipped') then
    raise exception 'Invalid delivery status';
  end if;

  perform pg_advisory_xact_lock(hashtext(trim(p_institution) || '|' || p_reporting_period_start::text));

  select coalesce(max(attempt_number),0)+1
    into v_attempt
  from public.institution_report_delivery_log
  where institution=trim(p_institution)
    and reporting_period_start=p_reporting_period_start;

  insert into public.institution_report_delivery_log(
    reporting_profile_id,institution,reporting_period_start,reporting_period_end,
    recipient_emails,status,attempt_number,provider_message_id,error_message,
    generated_at,sent_at
  ) values (
    p_reporting_profile_id,trim(p_institution),p_reporting_period_start,p_reporting_period_end,
    coalesce(p_recipient_emails,'{}'),p_status,v_attempt,p_provider_message_id,p_error_message,
    case when p_status in ('sent','failed') then now() else null end,
    case when p_status='sent' then now() else null end
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_monthly_report_delivery_service(uuid,text,date,date,text[],text,text,text) from public, anon, authenticated;
grant execute on function public.record_monthly_report_delivery_service(uuid,text,date,date,text[],text,text,text) to service_role;

comment on function public.get_monthly_reporting_profiles_for_service() is
  'Stage 2E server-only active reporting profile reader for automated monthly delivery.';
comment on function public.has_successful_monthly_report_delivery_service(uuid,date) is
  'Stage 2E server-only duplicate-delivery guard for automated monthly reporting.';
comment on function public.record_monthly_report_delivery_service(uuid,text,date,date,text[],text,text,text) is
  'Stage 2E server-only monthly report delivery logger. Not available to browser users.';
