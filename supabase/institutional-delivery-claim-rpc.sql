-- Draft for test deployment only. Never expose this RPC to browser roles.
-- Claim only eligible jobs, with row locks preventing parallel claims.
create or replace function public.claim_institutional_assessment_delivery_jobs(p_limit integer default 20)
returns setof public.institution_assessment_delivery_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid claim limit';
  end if;
  return query
  with available as (
    select j.id
    from public.institution_assessment_delivery_jobs j
    where j.status in ('queued','failed')
      and j.next_attempt_at <= now()
      and j.retry_count < 5
    order by j.next_attempt_at, j.created_at
    for update skip locked
    limit p_limit
  )
  update public.institution_assessment_delivery_jobs j
  set status = 'processing', claimed_at = now()
  from available a
  where j.id = a.id
  returning j.*;
end;
$$;
revoke all on function public.claim_institutional_assessment_delivery_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_institutional_assessment_delivery_jobs(integer) to service_role;
