-- CompassU Stage 2C: institutional trend analytics
-- Compares consecutive reporting periods using the Stage 2A analytics service.
-- The latest completed assessment overall is the canonical assessment for each student.

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
  if auth.uid() is null or not public.is_compassu_admin() then
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
grant execute on function public.get_institutional_trends(text,integer,integer,date) to authenticated;
comment on function public.get_institutional_trends(text,integer,integer,date) is 'CompassU Stage 2C admin-only longitudinal institutional analytics across consecutive reporting periods with inherited small-cell suppression.';
