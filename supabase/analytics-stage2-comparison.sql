-- CompassU Stage 2B: comparative institutional analytics
-- Admin-only, aggregate institution comparison with optional reporting-period filters.
-- Uses the existing Stage 2A analytics RPC so scoring and privacy rules remain centralized.

create or replace function public.get_institutional_comparison(
  p_institutions text[] default null,
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
  v_rows jsonb := '[]'::jsonb;
  v_name text;
  v_item jsonb;
begin
  if auth.uid() is null or not public.is_compassu_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'Start date cannot be after end date';
  end if;

  for v_name in
    select distinct trim(ai.institution)
    from public.account_institutions ai
    where nullif(trim(ai.institution),'') is not null
      and (p_institutions is null or cardinality(p_institutions)=0 or trim(ai.institution)=any(p_institutions))
    order by trim(ai.institution)
  loop
    v_item := public.get_institutional_analytics_v2(v_name,p_start_date,p_end_date);
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'institution',v_name,
      'participation',v_item->'participation',
      'dimensions',v_item->'dimensions',
      'career_clusters',v_item->'career_clusters',
      'top_majors',v_item->'top_majors',
      'top_careers',v_item->'top_careers'
    ));
  end loop;

  return jsonb_build_object(
    'generated_at',now(),
    'reporting_period',jsonb_build_object('start_date',p_start_date,'end_date',p_end_date,'filtered',p_start_date is not null or p_end_date is not null),
    'privacy',jsonb_build_object('small_cell_threshold',v_threshold,'aggregate_only',true),
    'institutions',v_rows
  );
end;
$$;

revoke all on function public.get_institutional_comparison(text[],date,date) from public;
grant execute on function public.get_institutional_comparison(text[],date,date) to authenticated;
comment on function public.get_institutional_comparison(text[],date,date) is 'CompassU Stage 2B admin-only comparative institutional analytics with optional reporting-period filters and inherited small-cell suppression.';
