-- CompassU Stage 3C: secure institutional administrator invitations
-- Requires Stage 3A tenant foundation and Stage 3B role-management functions.
-- This workflow lets authorized tenant administrators invite NEW administrative users
-- without exposing service-role credentials. Invitations are redeemed after normal
-- CompassU authentication and are bound to the invited email + authorized scope.

create extension if not exists pgcrypto;

create table if not exists public.admin_role_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('system_admin','institution_admin','counselor')),
  organization_id uuid references public.organizations(id) on delete cascade,
  tenant_institution_id uuid references public.tenant_institutions(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  constraint admin_role_invitation_scope_ck check (
    (role='system_admin' and organization_id is not null and tenant_institution_id is null)
    or
    (role in ('institution_admin','counselor') and tenant_institution_id is not null)
  )
);

create index if not exists admin_role_invitations_email_idx
  on public.admin_role_invitations(lower(email));
create index if not exists admin_role_invitations_scope_idx
  on public.admin_role_invitations(organization_id,tenant_institution_id,status);

alter table public.admin_role_invitations enable row level security;
revoke all on public.admin_role_invitations from anon, authenticated;

create or replace function public.can_create_compassu_admin_invitation(
  p_role text,
  p_organization_id uuid default null,
  p_tenant_institution_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then return false; end if;

  if p_role='system_admin' then
    return p_organization_id is not null
      and p_tenant_institution_id is null
      and public.is_compassu_master_admin();
  end if;

  if p_role not in ('institution_admin','counselor') or p_tenant_institution_id is null then
    return false;
  end if;

  select organization_id into v_org_id
  from public.tenant_institutions
  where id=p_tenant_institution_id and active;

  if v_org_id is null then return false; end if;
  if p_organization_id is not null and p_organization_id<>v_org_id then return false; end if;

  if p_role='institution_admin' then
    return public.is_compassu_master_admin()
      or public.is_compassu_system_admin(v_org_id);
  end if;

  return public.is_compassu_master_admin()
    or public.is_compassu_system_admin(v_org_id)
    or public.is_compassu_institution_admin(p_tenant_institution_id);
end;
$$;

create or replace function public.create_compassu_admin_invitation(
  p_email text,
  p_role text,
  p_organization_id uuid default null,
  p_tenant_institution_id uuid default null,
  p_expires_days integer default 7
)
returns table(invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_token text;
  v_hash text;
  v_org_id uuid:=p_organization_id;
  v_id uuid;
  v_expires timestamptz;
begin
  if auth.uid() is null then raise exception 'Administrator login required.'; end if;
  if v_email='' or position('@' in v_email)=0 then raise exception 'A valid email address is required.'; end if;
  if p_expires_days<1 or p_expires_days>30 then raise exception 'Invitation expiration must be between 1 and 30 days.'; end if;

  if p_tenant_institution_id is not null then
    select organization_id into v_org_id
    from public.tenant_institutions
    where id=p_tenant_institution_id and active;
  end if;

  if not public.can_create_compassu_admin_invitation(p_role,v_org_id,p_tenant_institution_id) then
    raise exception 'You are not authorized to invite this administrator role for the selected scope.';
  end if;

  update public.admin_role_invitations
  set status='expired'
  where status='pending' and expires_at<=now();

  update public.admin_role_invitations
  set status='revoked'
  where status='pending'
    and lower(email)=v_email
    and role=p_role
    and organization_id is not distinct from v_org_id
    and tenant_institution_id is not distinct from p_tenant_institution_id;

  v_token:=encode(gen_random_bytes(32),'hex');
  v_hash:=encode(digest(v_token,'sha256'),'hex');
  v_expires:=now()+make_interval(days=>p_expires_days);

  insert into public.admin_role_invitations(
    email,role,organization_id,tenant_institution_id,token_hash,status,expires_at,created_by
  ) values(
    v_email,p_role,v_org_id,p_tenant_institution_id,v_hash,'pending',v_expires,auth.uid()
  ) returning id into v_id;

  return query select v_id,v_token,v_expires;
end;
$$;

create or replace function public.get_compassu_admin_invitations()
returns table(
  invitation_id uuid,
  email text,
  role text,
  organization_id uuid,
  organization_name text,
  tenant_institution_id uuid,
  institution_name text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path=public,auth
as $$
  select
    i.id,i.email,i.role,i.organization_id,o.name,i.tenant_institution_id,ti.name,
    case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
    i.expires_at,i.created_at
  from public.admin_role_invitations i
  left join public.organizations o on o.id=i.organization_id
  left join public.tenant_institutions ti on ti.id=i.tenant_institution_id
  where auth.uid() is not null
    and (
      public.is_compassu_master_admin()
      or (i.organization_id is not null and public.is_compassu_system_admin(i.organization_id))
      or (i.tenant_institution_id is not null and public.is_compassu_institution_admin(i.tenant_institution_id))
    )
  order by i.created_at desc;
$$;

create or replace function public.revoke_compassu_admin_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_inv public.admin_role_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Administrator login required.'; end if;
  select * into v_inv from public.admin_role_invitations where id=p_invitation_id;
  if v_inv.id is null then raise exception 'Invitation not found.'; end if;
  if not public.can_create_compassu_admin_invitation(v_inv.role,v_inv.organization_id,v_inv.tenant_institution_id) then
    raise exception 'You are not authorized to revoke this invitation.';
  end if;
  update public.admin_role_invitations set status='revoked' where id=p_invitation_id and status='pending';
  return 'Administrator invitation revoked.';
end;
$$;

create or replace function public.accept_compassu_admin_invitation(p_token text)
returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_hash text:=encode(digest(coalesce(p_token,''),'sha256'),'hex');
  v_inv public.admin_role_invitations%rowtype;
  v_user_email text;
begin
  if auth.uid() is null then raise exception 'Sign in to CompassU before accepting this invitation.'; end if;
  select lower(email) into v_user_email from auth.users where id=auth.uid();
  if v_user_email is null then raise exception 'Unable to verify the signed-in CompassU account.'; end if;

  select * into v_inv
  from public.admin_role_invitations
  where token_hash=v_hash
  for update;

  if v_inv.id is null then raise exception 'This administrator invitation is invalid.'; end if;
  if v_inv.status<>'pending' then raise exception 'This administrator invitation is no longer active.'; end if;
  if v_inv.expires_at<=now() then
    update public.admin_role_invitations set status='expired' where id=v_inv.id;
    raise exception 'This administrator invitation has expired.';
  end if;
  if lower(v_inv.email)<>v_user_email then
    raise exception 'This invitation was issued to a different email address.';
  end if;

  if v_inv.role='system_admin' then
    insert into public.organization_memberships(user_id,organization_id,role,active,created_by)
    values(auth.uid(),v_inv.organization_id,'system_admin',true,v_inv.created_by)
    on conflict(user_id,organization_id,role) do update set active=true;
  else
    insert into public.institution_memberships(user_id,tenant_institution_id,role,active,created_by)
    values(auth.uid(),v_inv.tenant_institution_id,v_inv.role,true,v_inv.created_by)
    on conflict(user_id,tenant_institution_id,role) do update set active=true;
  end if;

  update public.admin_role_invitations
  set status='accepted',accepted_at=now(),accepted_by=auth.uid()
  where id=v_inv.id;

  return case v_inv.role
    when 'system_admin' then 'System / District Administrator access activated.'
    when 'institution_admin' then 'Institution Administrator access activated.'
    else 'Counselor / Advisor access activated.'
  end;
end;
$$;

revoke all on function public.can_create_compassu_admin_invitation(text,uuid,uuid) from public;
revoke all on function public.create_compassu_admin_invitation(text,text,uuid,uuid,integer) from public;
revoke all on function public.get_compassu_admin_invitations() from public;
revoke all on function public.revoke_compassu_admin_invitation(uuid) from public;
revoke all on function public.accept_compassu_admin_invitation(text) from public;

grant execute on function public.can_create_compassu_admin_invitation(text,uuid,uuid) to authenticated;
grant execute on function public.create_compassu_admin_invitation(text,text,uuid,uuid,integer) to authenticated;
grant execute on function public.get_compassu_admin_invitations() to authenticated;
grant execute on function public.revoke_compassu_admin_invitation(uuid) to authenticated;
grant execute on function public.accept_compassu_admin_invitation(text) to authenticated;

comment on table public.admin_role_invitations is 'Stage 3C tenant-scoped administrator invitations. Plaintext tokens are never stored.';
