-- STAGING-ONLY, READ-ONLY completion eligibility function.
-- Does not grant trusted completion authority, change existing RPC, or send mail.
-- Intended as an independently testable prerequisite for a future atomic cutover.
create or replace function public.institutional_completion_eligibility(p_attempt_id uuid)
returns table (
  owned boolean,
  response_count bigint,
  eligible boolean
)
language sql
security invoker
set search_path = ''
stable
as $$
  with owner_check as (
    select exists (
      select 1 from public.assessment_attempts a
      where a.id = p_attempt_id
        and a.user_id = (select auth.uid())
        and a.status = 'in_progress'
        and a.completed_at is null
    ) as is_owned
  ), counted as (
    select count(*)::bigint as total
    from public.assessment_responses r
    where r.attempt_id = p_attempt_id
      and r.user_id = (select auth.uid())
  )
  select o.is_owned, c.total, (o.is_owned and c.total >= 80)
  from owner_check o cross join counted c;
$$;
revoke all on function public.institutional_completion_eligibility(uuid)
  from public, anon;
grant execute on function public.institutional_completion_eligibility(uuid)
  to authenticated;
