-- CompassU administrator scalability remediation
-- Target: 50,000+ accounts without loading the entire auth user universe into an Edge Function or browser.
-- Install in Supabase SQL Editor before deploying the matching admin-console Edge Function.

begin;

create index if not exists assessment_attempts_user_status_idx
  on public.assessment_attempts (user_id, status);

create index if not exists assessment_attempts_completed_at_idx
  on public.assessment_attempts (completed_at)
  where completed_at is not null;

create index if not exists assessment_attempts_started_at_idx
  on public.assessment_attempts (started_at)
  where started_at is not null;

create index if not exists profiles_name_idx
  on public.profiles (lower(coalesce(first_name,'')), lower(coalesce(last_name,'')));

create index if not exists account_institutions_institution_idx
  on public.account_institutions (lower(coalesce(institution,'')));

-- Compact dashboard payload: all account/assessment counts and a complete 30-day series are
-- calculated in PostgreSQL. No auth-user pagination is required for the dashboard.
create or replace function public.admin_dashboard_overview_50k()
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
with
account_stats as (
  select
    count(*)::bigint as total_accounts,
    count(*) filter (where banned_until is not null and banned_until > now())::bigint as suspended_accounts,
    count(*) filter (where created_at >= now() - interval '7 days')::bigint as new_accounts_7d,
    count(*) filter (where created_at >= now() - interval '30 days')::bigint as new_accounts_30d
  from auth.users
),
attempt_stats as (
  select
    count(*) filter (where status = 'completed')::bigint as completed_surveys,
    count(distinct user_id) filter (where status = 'completed')::bigint as accounts_with_completed_survey,
    count(*) filter (where status = 'in_progress')::bigint as in_progress_surveys
  from public.assessment_attempts
),
days as (
  select generate_series(current_date - 29, current_date, interval '1 day')::date as day
),
new_accounts as (
  select created_at::date as day, count(*)::bigint as n
  from auth.users
  where created_at >= current_date - 29
  group by created_at::date
),
completions as (
  select completed_at::date as day, count(*)::bigint as n
  from public.assessment_attempts
  where status = 'completed'
    and completed_at >= current_date - 29
  group by completed_at::date
),
trend as (
  select jsonb_agg(
    jsonb_build_object(
      'date', to_char(d.day,'YYYY-MM-DD'),
      'new_accounts', coalesce(na.n,0),
      'completed_surveys', coalesce(c.n,0)
    ) order by d.day
  ) as rows
  from days d
  left join new_accounts na on na.day=d.day
  left join completions c on c.day=d.day
)
select jsonb_build_object(
  'stats', jsonb_build_object(
    'total_accounts', a.total_accounts,
    'completed_surveys', t.completed_surveys,
    'accounts_with_completed_survey', t.accounts_with_completed_survey,
    'completion_rate', case when a.total_accounts=0 then 0 else round((t.accounts_with_completed_survey::numeric/a.total_accounts::numeric)*100,1) end,
    'in_progress_surveys', t.in_progress_surveys,
    'new_accounts_7d', a.new_accounts_7d,
    'new_accounts_30d', a.new_accounts_30d,
    'suspended_accounts', a.suspended_accounts
  ),
  'trend', coalesce(tr.rows,'[]'::jsonb)
)
from account_stats a cross join attempt_stats t cross join trend tr;
$$;

-- Server-side account search/paging. Only one bounded page is returned to the browser.
-- Search covers email, first name, last name, state and institution.
create or replace function public.admin_account_page_50k(
  p_page integer default 1,
  p_page_size integer default 50,
  p_search text default null,
  p_institution text default null
)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
with params as (
  select
    greatest(coalesce(p_page,1),1) as page,
    least(greatest(coalesce(p_page_size,50),1),100) as page_size,
    nullif(trim(coalesce(p_search,'')),'') as search,
    nullif(trim(coalesce(p_institution,'')),'') as institution
),
filtered as (
  select
    u.id,
    coalesce(u.email,'') as email,
    coalesce(p.first_name, u.raw_user_meta_data->>'first_name','') as first_name,
    coalesce(p.last_name, u.raw_user_meta_data->>'last_name','') as last_name,
    coalesce(p.state,'') as state,
    coalesce(ai.institution,'') as institution,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.banned_until,
    (u.banned_until is not null and u.banned_until > now()) as is_suspended
  from auth.users u
  left join public.profiles p on p.id=u.id
  left join public.account_institutions ai on lower(ai.email)=lower(coalesce(u.email,''))
  cross join params x
  where
    (x.institution is null or lower(coalesce(ai.institution,''))=lower(x.institution))
    and (
      x.search is null
      or lower(coalesce(u.email,'')) like '%'||lower(x.search)||'%'
      or lower(coalesce(p.first_name, u.raw_user_meta_data->>'first_name','')) like '%'||lower(x.search)||'%'
      or lower(coalesce(p.last_name, u.raw_user_meta_data->>'last_name','')) like '%'||lower(x.search)||'%'
      or lower(coalesce(p.state,'')) like '%'||lower(x.search)||'%'
      or lower(coalesce(ai.institution,'')) like '%'||lower(x.search)||'%'
    )
),
counts as (
  select count(*)::bigint as total from filtered
),
page_users as (
  select f.*
  from filtered f cross join params x
  order by f.created_at desc, f.id
  limit (select page_size from params)
  offset ((select page from params)-1)*(select page_size from params)
),
attempt_rollup as (
  select
    a.user_id,
    count(*)::bigint as assessment_count,
    count(*) filter (where a.status='completed')::bigint as completed_surveys,
    count(*) filter (where a.status='in_progress')::bigint as in_progress_surveys,
    max(a.completed_at) filter (where a.completed_at is not null) as last_completed_at
  from public.assessment_attempts a
  join page_users pu on pu.id=a.user_id
  group by a.user_id
),
rows as (
  select jsonb_agg(
    jsonb_build_object(
      'id', pu.id,
      'email', pu.email,
      'first_name', pu.first_name,
      'last_name', pu.last_name,
      'state', pu.state,
      'institution', pu.institution,
      'created_at', pu.created_at,
      'last_sign_in_at', pu.last_sign_in_at,
      'email_confirmed_at', pu.email_confirmed_at,
      'assessment_count', coalesce(ar.assessment_count,0),
      'completed_surveys', coalesce(ar.completed_surveys,0),
      'in_progress_surveys', coalesce(ar.in_progress_surveys,0),
      'last_completed_at', ar.last_completed_at,
      'is_suspended', pu.is_suspended,
      'banned_until', pu.banned_until
    ) order by pu.created_at desc, pu.id
  ) as users
  from page_users pu
  left join attempt_rollup ar on ar.user_id=pu.id
)
select jsonb_build_object(
  'users', coalesce(r.users,'[]'::jsonb),
  'pagination', jsonb_build_object(
    'page', p.page,
    'page_size', p.page_size,
    'total', c.total,
    'total_pages', greatest(1,ceil(c.total::numeric/p.page_size::numeric)::integer),
    'has_previous', p.page>1,
    'has_next', p.page < greatest(1,ceil(c.total::numeric/p.page_size::numeric)::integer)
  )
)
from params p cross join counts c cross join rows r;
$$;

-- Exact duplicate lookup for invitations. This replaces scanning all Auth users.
create or replace function public.admin_account_email_exists_50k(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select exists(
    select 1 from auth.users
    where lower(email)=lower(trim(coalesce(p_email,'')))
  );
$$;

-- Lookup one account by id for targeted administrative actions.
create or replace function public.admin_account_identity_50k(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  select case when u.id is null then null else jsonb_build_object(
    'id',u.id,
    'email',coalesce(u.email,''),
    'is_suspended',(u.banned_until is not null and u.banned_until>now()),
    'banned_until',u.banned_until
  ) end
  from (select p_user_id as requested_id) q
  left join auth.users u on u.id=q.requested_id;
$$;

-- These functions are deliberately service-role only. Browser clients and ordinary
-- authenticated users must go through the admin-console authorization boundary.
revoke all on function public.admin_dashboard_overview_50k() from public, anon, authenticated;
revoke all on function public.admin_account_page_50k(integer,integer,text,text) from public, anon, authenticated;
revoke all on function public.admin_account_email_exists_50k(text) from public, anon, authenticated;
revoke all on function public.admin_account_identity_50k(uuid) from public, anon, authenticated;

grant execute on function public.admin_dashboard_overview_50k() to service_role;
grant execute on function public.admin_account_page_50k(integer,integer,text,text) to service_role;
grant execute on function public.admin_account_email_exists_50k(text) to service_role;
grant execute on function public.admin_account_identity_50k(uuid) to service_role;

commit;
