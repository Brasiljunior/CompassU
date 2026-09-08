-- CompassU Stage 3A: additive multi-tenant foundation
-- REVIEW/TEST BEFORE PRODUCTION INSTALLATION.
-- This migration intentionally preserves account_institutions and admin_users.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organization_type text not null default 'institutional_customer'
    check (organization_type in ('institutional_customer','district','system','independent')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, normalized_name)
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('system_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, organization_id, role)
);

create table if not exists public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  role text not null check (role in ('institution_admin','counselor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, institution_id, role)
);

create index if not exists institutions_organization_idx on public.institutions(organization_id);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id) where active;
create index if not exists institution_memberships_user_idx on public.institution_memberships(user_id) where active;

alter table public.organizations enable row level security;
alter table public.institutions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.institution_memberships enable row level security;

create or replace function public.is_compassu_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id=auth.uid() and coalesce(au.role,'master_admin')='master_admin'
  );
$$;

create or replace function public.can_access_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and (
    public.is_compassu_master_admin()
    or exists (
      select 1 from public.organization_memberships om
      where om.user_id=auth.uid() and om.organization_id=p_organization_id and om.active
    )
    or exists (
      select 1
      from public.institution_memberships im
      join public.institutions i on i.id=im.institution_id
      where im.user_id=auth.uid() and i.organization_id=p_organization_id and im.active
    )
  );
$$;

create or replace function public.can_access_institution(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and (
    public.is_compassu_master_admin()
    or exists (
      select 1 from public.institution_memberships im
      where im.user_id=auth.uid() and im.institution_id=p_institution_id and im.active
    )
    or exists (
      select 1
      from public.institutions i
      join public.organization_memberships om on om.organization_id=i.organization_id
      where i.id=p_institution_id and om.user_id=auth.uid() and om.active
    )
  );
$$;

-- Read policies are additive. Write workflows will be introduced with explicit role checks in Stage 3B/3C.
drop policy if exists organizations_tenant_read on public.organizations;
create policy organizations_tenant_read on public.organizations for select to authenticated
using (public.can_access_organization(id));

drop policy if exists institutions_tenant_read on public.institutions;
create policy institutions_tenant_read on public.institutions for select to authenticated
using (public.can_access_institution(id));

drop policy if exists organization_memberships_tenant_read on public.organization_memberships;
create policy organization_memberships_tenant_read on public.organization_memberships for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists institution_memberships_tenant_read on public.institution_memberships;
create policy institution_memberships_tenant_read on public.institution_memberships for select to authenticated
using (public.can_access_institution(institution_id));

revoke all on public.organizations,public.institutions,public.organization_memberships,public.institution_memberships from anon;
grant select on public.organizations,public.institutions,public.organization_memberships,public.institution_memberships to authenticated;

-- Preview current institution-name assignments before any backfill.
create or replace view public.stage3a_institution_assignment_readiness as
select
  trim(ai.institution) institution_name,
  lower(trim(ai.institution)) normalized_institution_name,
  count(*)::int assigned_accounts
from public.account_institutions ai
where nullif(trim(ai.institution),'') is not null
group by trim(ai.institution),lower(trim(ai.institution));

revoke all on public.stage3a_institution_assignment_readiness from public,anon;
grant select on public.stage3a_institution_assignment_readiness to authenticated;

comment on table public.organizations is 'CompassU Stage 3 customer/system tenant boundary.';
comment on table public.institutions is 'CompassU institutions belonging to a customer/system organization.';
comment on table public.organization_memberships is 'Tenant-scoped system administrator memberships.';
comment on table public.institution_memberships is 'Institution-scoped administrator and counselor memberships.';
