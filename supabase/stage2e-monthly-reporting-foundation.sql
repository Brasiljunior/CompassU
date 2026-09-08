-- CompassU Stage 2E-A: Automated Monthly Institutional Reporting Foundation
-- Centralized Master Administrator configuration only. No institution/customer admin access.

create extension if not exists pgcrypto;

create table if not exists public.institution_reporting_profiles (
  id uuid primary key default gen_random_uuid(),
  institution text not null unique,
  recipient_emails text[] not null default '{}',
  active boolean not null default true,
  delivery_day smallint not null default 5 check (delivery_day between 1 and 28),
  timezone text not null default 'America/Chicago',
  include_institutional_analytics boolean not null default true,
  include_institutional_trends boolean not null default true,
  include_executive_insights boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_reporting_profiles_recipient_required check (
    active = false or cardinality(recipient_emails) > 0
  )
);

create table if not exists public.institution_report_delivery_log (
  id uuid primary key default gen_random_uuid(),
  reporting_profile_id uuid references public.institution_reporting_profiles(id) on delete set null,
  institution text not null,
  reporting_period_start date not null,
  reporting_period_end date not null,
  recipient_emails text[] not null default '{}',
  status text not null check (status in ('scheduled','generating','sent','failed','skipped')),
  attempt_number integer not null default 1 check (attempt_number > 0),
  provider_message_id text,
  error_message text,
  generated_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (institution, reporting_period_start, attempt_number)
);

create index if not exists institution_reporting_profiles_active_idx
  on public.institution_reporting_profiles(active, delivery_day);

create index if not exists institution_report_delivery_log_period_idx
  on public.institution_report_delivery_log(reporting_period_start desc, institution);

alter table public.institution_reporting_profiles enable row level security;
alter table public.institution_report_delivery_log enable row level security;

revoke all on public.institution_reporting_profiles from anon, authenticated;
revoke all on public.institution_report_delivery_log from anon, authenticated;

drop policy if exists "Master admin manages monthly reporting profiles" on public.institution_reporting_profiles;
create policy "Master admin manages monthly reporting profiles"
  on public.institution_reporting_profiles
  for all
  to authenticated
  using (public.is_compassu_admin())
  with check (public.is_compassu_admin());

drop policy if exists "Master admin reads monthly report delivery log" on public.institution_report_delivery_log;
create policy "Master admin reads monthly report delivery log"
  on public.institution_report_delivery_log
  for select
  to authenticated
  using (public.is_compassu_admin());

grant select, insert, update on public.institution_reporting_profiles to authenticated;
grant select on public.institution_report_delivery_log to authenticated;

create or replace function public.set_institution_monthly_reporting_profile(
  p_institution text,
  p_recipient_emails text[],
  p_active boolean default true,
  p_delivery_day integer default 5,
  p_timezone text default 'America/Chicago',
  p_include_institutional_analytics boolean default true,
  p_include_institutional_trends boolean default true,
  p_include_executive_insights boolean default true
)
returns public.institution_reporting_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.institution_reporting_profiles;
  v_emails text[];
begin
  if auth.uid() is null or not public.is_compassu_admin() then
    raise exception 'Master administrator access required';
  end if;

  if nullif(trim(p_institution), '') is null then
    raise exception 'Institution is required';
  end if;

  if p_delivery_day < 1 or p_delivery_day > 28 then
    raise exception 'Delivery day must be between 1 and 28';
  end if;

  select coalesce(array_agg(distinct lower(trim(email))) filter (where trim(email) <> ''), '{}')
    into v_emails
  from unnest(coalesce(p_recipient_emails, '{}')) email;

  if coalesce(p_active, true) and cardinality(v_emails) = 0 then
    raise exception 'At least one report recipient email is required for an active profile';
  end if;

  insert into public.institution_reporting_profiles (
    institution,
    recipient_emails,
    active,
    delivery_day,
    timezone,
    include_institutional_analytics,
    include_institutional_trends,
    include_executive_insights,
    updated_at
  ) values (
    trim(p_institution),
    v_emails,
    coalesce(p_active, true),
    p_delivery_day,
    coalesce(nullif(trim(p_timezone), ''), 'America/Chicago'),
    coalesce(p_include_institutional_analytics, true),
    coalesce(p_include_institutional_trends, true),
    coalesce(p_include_executive_insights, true),
    now()
  )
  on conflict (institution) do update set
    recipient_emails = excluded.recipient_emails,
    active = excluded.active,
    delivery_day = excluded.delivery_day,
    timezone = excluded.timezone,
    include_institutional_analytics = excluded.include_institutional_analytics,
    include_institutional_trends = excluded.include_institutional_trends,
    include_executive_insights = excluded.include_executive_insights,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.set_institution_monthly_reporting_profile(text,text[],boolean,integer,text,boolean,boolean,boolean) to authenticated;

create or replace function public.get_monthly_reporting_profiles()
returns setof public.institution_reporting_profiles
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.institution_reporting_profiles p
  where auth.uid() is not null
    and public.is_compassu_admin()
  order by p.institution;
$$;

grant execute on function public.get_monthly_reporting_profiles() to authenticated;

create or replace function public.get_monthly_report_delivery_log(p_limit integer default 100)
returns setof public.institution_report_delivery_log
language sql
security definer
set search_path = public
as $$
  select l.*
  from public.institution_report_delivery_log l
  where auth.uid() is not null
    and public.is_compassu_admin()
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit,100),500));
$$;

grant execute on function public.get_monthly_report_delivery_log(integer) to authenticated;

comment on table public.institution_reporting_profiles is
  'Stage 2E centralized monthly institutional report delivery configuration. Master Administrator only.';

comment on table public.institution_report_delivery_log is
  'Stage 2E audit log for automated monthly institutional report generation and email delivery.';
