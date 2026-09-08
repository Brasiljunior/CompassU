-- CompassU Stage 3A: additive multi-tenant foundation
-- REVIEW/TEST BEFORE PRODUCTION INSTALLATION.
-- This migration intentionally preserves account_institutions, admin_users,
-- and the existing public.institutions catalog (bigint primary key).

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

-- Stage 3 tenant institutions are intentionally separate from the existing
-- public.institutions reference/catalog table, whose id is bigint.
create table if not exists public.tenant_institutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  catalog_institution_id bigint references public.institutions(id) on delete set null,
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
  tenant_institution_id uuid not null references public.tenant_institutions(id) on delete cascade,
  role text not null check (role in ('institution_admin','counselor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, tenant_institution_id, role)
);

create index if not exists tenant_institutions_organization_idx on public.tenant_institutions(organization_id);
create index if not exists tenant_institutions_catalog_idx on public.tenant_institutions(catalog_institution_id) where catalog_institution_id is not null;
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id) where active;
create index if not exists institution_memberships_user_idx on public.institution_memberships(user_id) where active;

alter table public.organizations enable row level security;
alter table public.tenant_institutions enable row level security;
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
      join public.tenant_institutions ti on ti.id=im.tenant_institution_id
      where im.user_id=auth.uid() and ti.organization_id=p_organization_id and im.active
    )
  );
$$;

create or replace function public.can_access_institution(p_tenant_institution_id uuid)
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
      where im.user_id=auth.uid() and im.tenant_institution_id=p_tenant_institution_id and im.active
    )
    or exists (
      select 1
      from public.tenant_institutions ti
      join public.organization_memberships om on om.organization_id=ti.organization_id
      where ti.id=p_tenant_institution_id and om.user_id=auth.uid() and om.active
    )
  );
$$;

revoke all on function public.is_compassu_master_admin() from public;
revoke all on function public.can_access_organization(uuid) from public;
revoke all on function public.can_access_institution(uuid) from public;
grant execute on function public.is_compassu_master_admin() to authenticated;
grant execute on function public.can_access_organization(uuid) to authenticated;
grant execute on function public.can_access_institution(uuid) to authenticated;

drop policy if exists organizations_tenant_read on public.organizations;
create policy organizations_tenant_read on public.organizations for select to authenticated
using (public.can_access_organization(id));

drop policy if exists tenant_institutions_tenant_read on public.tenant_institutions;
create policy tenant_institutions_tenant_read on public.tenant_institutions for select to authenticated
using (public.can_access_institution(id));

drop policy if exists organization_memberships_tenant_read on public.organization_memberships;
create policy organization_memberships_tenant_read on public.organization_memberships for select to authenticated
using (public.can_access_organization(organization_id));

drop policy if exists institution_memberships_tenant_read on public.institution_memberships;
create policy institution_memberships_tenant_read on public.institution_memberships for select to authenticated
using (public.can_access_institution(tenant_institution_id));

revoke all on public.organizations,public.tenant_institutions,public.organization_memberships,public.institution_memberships from anon;
grant select on public.organizations,public.tenant_institutions,public.organization_memberships,public.institution_memberships to authenticated;

-- Admin-only readiness function. It exposes aggregate legacy assignment counts only.
create or replace function public.stage3a_institution_assignment_readiness()
returns table (
  institution_name text,
  normalized_institution_name text,
  assigned_accounts integer
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select trim(ai.institution), lower(trim(ai.institution)), count(*)::int
  from public.account_institutions ai
  where public.is_compassu_master_admin()
    and nullif(trim(ai.institution),'') is not null
  group by trim(ai.institution),lower(trim(ai.institution));
$$;

revoke all on function public.stage3a_institution_assignment_readiness() from public;
grant execute on function public.stage3a_institution_assignment_readiness() to authenticated;

comment on table public.organizations is 'CompassU Stage 3 customer/system tenant boundary.';
comment on table public.tenant_institutions is 'CompassU tenant institutions; separate from the existing bigint institutions reference catalog.';
comment on column public.tenant_institutions.catalog_institution_id is 'Optional link to existing public.institutions reference/catalog row.';
comment on table public.organization_memberships is 'Tenant-scoped system administrator memberships.';
comment on table public.institution_memberships is 'Institution-scoped administrator and counselor memberships.';
