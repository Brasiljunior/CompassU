-- CompassU Stage 3B: controlled administrative role management
-- Requires stage3b-role-foundation.sql.
-- Keeps direct membership table writes closed to browser clients.

create or replace function public.get_compassu_role_assignments()
returns table (
  user_id uuid,
  email text,
  role text,
  active boolean,
  organization_id uuid,
  organization_name text,
  tenant_institution_id uuid,
  institution_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with caller as (
    select auth.uid() as user_id,
           public.is_compassu_master_admin() as is_master
  ), org_roles as (
    select
      u.id as user_id,
      u.email::text as email,
      om.role,
      om.active,
      o.id as organization_id,
      o.name as organization_name,
      null::uuid as tenant_institution_id,
      null::text as institution_name,
      om.created_at
    from public.organization_memberships om
    join auth.users u on u.id=om.user_id
    join public.organizations o on o.id=om.organization_id
    cross join caller c
    where c.is_master
       or public.is_compassu_system_admin(o.id)
  ), institution_roles as (
    select
      u.id as user_id,
      u.email::text as email,
      im.role,
      im.active,
      o.id as organization_id,
      o.name as organization_name,
      ti.id as tenant_institution_id,
      ti.name as institution_name,
      im.created_at
    from public.institution_memberships im
    join auth.users u on u.id=im.user_id
    join public.tenant_institutions ti on ti.id=im.tenant_institution_id
    join public.organizations o on o.id=ti.organization_id
    cross join caller c
    where c.is_master
       or public.is_compassu_system_admin(o.id)
       or public.is_compassu_institution_admin(ti.id)
  )
  select * from org_roles
  union all
  select * from institution_roles
  order by organization_name, institution_name nulls first, role, email;
$$;

create or replace function public.set_compassu_admin_membership(
  p_user_email text,
  p_role text,
  p_organization_id uuid default null,
  p_tenant_institution_id uuid default null,
  p_active boolean default true
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_email text := lower(trim(coalesce(p_user_email,'')));
begin
  if auth.uid() is null then
    raise exception 'Administrator login required.';
  end if;

  if v_email='' then
    raise exception 'User email is required.';
  end if;

  if p_role not in ('system_admin','institution_admin','counselor') then
    raise exception 'Unsupported administrator role.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email)=v_email
  limit 1;

  if v_user_id is null then
    raise exception 'No CompassU account exists for that email address.';
  end if;

  if p_role='system_admin' then
    if p_organization_id is null or p_tenant_institution_id is not null then
      raise exception 'System Administrator requires an organization scope.';
    end if;

    if not public.is_compassu_master_admin() then
      raise exception 'Only a CompassU Master Administrator can manage System Administrators.';
    end if;

    if not exists(select 1 from public.organizations where id=p_organization_id and active) then
      raise exception 'Organization not found or inactive.';
    end if;

    update public.organization_memberships
    set active=false
    where user_id=v_user_id
      and organization_id=p_organization_id
      and role='system_admin'
      and active
      and not p_active;

    if p_active then
      insert into public.organization_memberships(user_id,organization_id,role,active,created_by)
      values(v_user_id,p_organization_id,'system_admin',true,auth.uid())
      on conflict(user_id,organization_id,role)
      do update set active=true, created_by=auth.uid();
    end if;

    return case when p_active then 'System Administrator access activated.' else 'System Administrator access deactivated.' end;
  end if;

  if p_tenant_institution_id is null then
    raise exception 'Institution-scoped role requires an institution.';
  end if;

  select organization_id into v_org_id
  from public.tenant_institutions
  where id=p_tenant_institution_id and active;

  if v_org_id is null then
    raise exception 'Institution not found or inactive.';
  end if;

  if p_organization_id is not null and p_organization_id is distinct from v_org_id then
    raise exception 'Institution does not belong to the selected organization.';
  end if;

  if p_role='institution_admin' then
    if not (
      public.is_compassu_master_admin()
      or public.is_compassu_system_admin(v_org_id)
    ) then
      raise exception 'You are not authorized to manage Institution Administrators for this institution.';
    end if;
  elsif p_role='counselor' then
    if not (
      public.is_compassu_master_admin()
      or public.is_compassu_system_admin(v_org_id)
      or public.is_compassu_institution_admin(p_tenant_institution_id)
    ) then
      raise exception 'You are not authorized to manage Counselors/Advisors for this institution.';
    end if;
  end if;

  -- One active institution role per user per institution. Preserve historical rows by deactivation.
  if p_active then
    update public.institution_memberships
    set active=false
    where user_id=v_user_id
      and tenant_institution_id=p_tenant_institution_id
      and role<>p_role
      and active;

    insert into public.institution_memberships(user_id,tenant_institution_id,role,active,created_by)
    values(v_user_id,p_tenant_institution_id,p_role,true,auth.uid())
    on conflict(user_id,tenant_institution_id,role)
    do update set active=true, created_by=auth.uid();
  else
    update public.institution_memberships
    set active=false
    where user_id=v_user_id
      and tenant_institution_id=p_tenant_institution_id
      and role=p_role
      and active;
  end if;

  return case
    when p_active and p_role='institution_admin' then 'Institution Administrator access activated.'
    when p_active and p_role='counselor' then 'Counselor/Advisor access activated.'
    when not p_active and p_role='institution_admin' then 'Institution Administrator access deactivated.'
    else 'Counselor/Advisor access deactivated.'
  end;
end;
$$;

revoke all on function public.get_compassu_role_assignments() from public;
revoke all on function public.set_compassu_admin_membership(text,text,uuid,uuid,boolean) from public;
grant execute on function public.get_compassu_role_assignments() to authenticated;
grant execute on function public.set_compassu_admin_membership(text,text,uuid,uuid,boolean) to authenticated;

comment on function public.get_compassu_role_assignments() is
  'Stage 3B scoped administrative membership listing. Returns administrator identity only, never student assessment data.';
comment on function public.set_compassu_admin_membership(text,text,uuid,uuid,boolean) is
  'Stage 3B controlled administrator role assignment/deactivation with hierarchy enforcement.';
