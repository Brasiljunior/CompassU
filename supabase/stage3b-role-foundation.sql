-- CompassU Stage 3B: role-based administration foundation
-- Additive migration built on Stage 3A tenant tables.
-- Existing master-admin behavior remains compatible.
-- Tenant-role assignment UI/user management is deferred to Stage 3C.

-- Resolve whether the current user is a system administrator for an organization.
create or replace function public.is_compassu_system_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organization_memberships om
    where om.user_id = auth.uid()
      and om.organization_id = p_organization_id
      and om.role = 'system_admin'
      and om.active
  );
$$;

-- Resolve whether the current user is an institution administrator for a tenant institution.
create or replace function public.is_compassu_institution_admin(p_tenant_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.institution_memberships im
    where im.user_id = auth.uid()
      and im.tenant_institution_id = p_tenant_institution_id
      and im.role = 'institution_admin'
      and im.active
  );
$$;

-- Resolve whether the current user is a counselor/advisor for a tenant institution.
create or replace function public.is_compassu_counselor(p_tenant_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.institution_memberships im
    where im.user_id = auth.uid()
      and im.tenant_institution_id = p_tenant_institution_id
      and im.role = 'counselor'
      and im.active
  );
$$;

-- Management boundary for organization-level administration.
-- Only CompassU master administrators and system administrators may manage an organization.
create or replace function public.can_manage_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and (
    public.is_compassu_master_admin()
    or public.is_compassu_system_admin(p_organization_id)
  );
$$;

-- Management boundary for institution-level administration.
-- Master admins may manage all institutions; system admins may manage institutions
-- inside their organization; institution admins may manage only their own institution.
create or replace function public.can_manage_institution(p_tenant_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and (
    public.is_compassu_master_admin()
    or public.is_compassu_institution_admin(p_tenant_institution_id)
    or exists (
      select 1
      from public.tenant_institutions ti
      where ti.id = p_tenant_institution_id
        and public.is_compassu_system_admin(ti.organization_id)
    )
  );
$$;

-- Read-only role/scope context for the signed-in administrator.
-- This deliberately returns no student/account PII.
create or replace function public.get_compassu_admin_context()
returns table (
  role text,
  scope_type text,
  organization_id uuid,
  organization_name text,
  tenant_institution_id uuid,
  institution_name text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    'master_admin'::text,
    'platform'::text,
    null::uuid,
    'CompassU'::text,
    null::uuid,
    null::text
  where public.is_compassu_master_admin()

  union all

  select
    'system_admin'::text,
    'organization'::text,
    o.id,
    o.name,
    null::uuid,
    null::text
  from public.organization_memberships om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and om.role = 'system_admin'
    and om.active
    and o.active

  union all

  select
    im.role,
    'institution'::text,
    o.id,
    o.name,
    ti.id,
    ti.name
  from public.institution_memberships im
  join public.tenant_institutions ti on ti.id = im.tenant_institution_id
  join public.organizations o on o.id = ti.organization_id
  where im.user_id = auth.uid()
    and im.role in ('institution_admin','counselor')
    and im.active
    and ti.active
    and o.active;
$$;

-- The authenticated application may evaluate role helpers/context, but anonymous clients may not.
revoke all on function public.is_compassu_system_admin(uuid) from public;
revoke all on function public.is_compassu_institution_admin(uuid) from public;
revoke all on function public.is_compassu_counselor(uuid) from public;
revoke all on function public.can_manage_organization(uuid) from public;
revoke all on function public.can_manage_institution(uuid) from public;
revoke all on function public.get_compassu_admin_context() from public;

grant execute on function public.is_compassu_system_admin(uuid) to authenticated;
grant execute on function public.is_compassu_institution_admin(uuid) to authenticated;
grant execute on function public.is_compassu_counselor(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.can_manage_institution(uuid) to authenticated;
grant execute on function public.get_compassu_admin_context() to authenticated;

-- Keep membership writes behind service-side / future controlled RPC workflows.
-- Stage 3B intentionally does not grant direct INSERT/UPDATE/DELETE to authenticated clients.
revoke insert, update, delete on public.organization_memberships from authenticated;
revoke insert, update, delete on public.institution_memberships from authenticated;

comment on function public.get_compassu_admin_context() is
  'Stage 3B signed-in administrative role and tenant-scope context. Returns no student/account PII.';
comment on function public.can_manage_organization(uuid) is
  'Stage 3B organization management authorization boundary.';
comment on function public.can_manage_institution(uuid) is
  'Stage 3B institution management authorization boundary.';
