-- Staging-only recovery for jobs left processing after worker interruption.
-- Do NOT automatically resend: the email provider may have accepted a message
-- before the worker crashed. Require manual provider-log reconciliation.
create or replace function public.quarantine_stale_institutional_delivery_jobs(
  p_older_than_minutes integer default 30,
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized';
  end if;
  if p_older_than_minutes is null or p_older_than_minutes < 15 or p_older_than_minutes > 1440 then
    raise exception 'Invalid lease age';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Invalid quarantine limit';
  end if;
  with stale as (
    select id
    from public.institution_assessment_delivery_jobs
    where status = 'processing'
      and claimed_at < now() - make_interval(mins => p_older_than_minutes)
    order by claimed_at
    for update skip locked
    limit p_limit
  ), quarantined as (
    update public.institution_assessment_delivery_jobs j
    set status = 'skipped',
        last_error_code = 'provider_confirmation_unknown',
        next_attempt_at = 'infinity'::timestamptz
    from stale s
    where j.id = s.id and j.status = 'processing'
    returning j.id
  )
  select count(*) into v_count from quarantined;
  return v_count;
end;
$$;
revoke all on function public.quarantine_stale_institutional_delivery_jobs(integer,integer) from public, anon, authenticated;
grant execute on function public.quarantine_stale_institutional_delivery_jobs(integer,integer) to service_role;
