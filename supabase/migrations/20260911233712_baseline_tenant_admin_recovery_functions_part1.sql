begin;
CREATE OR REPLACE FUNCTION public.is_compassu_system_admin(p_organization_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$ select auth.uid() is not null and exists (select 1 from public.organization_memberships om where om.user_id=auth.uid() and om.organization_id=p_organization_id and om.role='system_admin' and om.active); $function$;
CREATE OR REPLACE FUNCTION public.is_compassu_institution_admin(p_tenant_institution_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$ select auth.uid() is not null and exists (select 1 from public.institution_memberships im where im.user_id=auth.uid() and im.tenant_institution_id=p_tenant_institution_id and im.role='institution_admin' and im.active); $function$;
CREATE OR REPLACE FUNCTION public.is_compassu_counselor(p_tenant_institution_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$ select auth.uid() is not null and exists (select 1 from public.institution_memberships im where im.user_id=auth.uid() and im.tenant_institution_id=p_tenant_institution_id and im.role='counselor' and im.active); $function$;
CREATE OR REPLACE FUNCTION public.can_manage_organization(p_organization_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$ select auth.uid() is not null and (public.is_compassu_master_admin() or public.is_compassu_system_admin(p_organization_id)); $function$;
CREATE OR REPLACE FUNCTION public.can_manage_institution(p_tenant_institution_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$ select auth.uid() is not null and (public.is_compassu_master_admin() or public.is_compassu_institution_admin(p_tenant_institution_id) or exists (select 1 from public.tenant_institutions ti where ti.id=p_tenant_institution_id and public.is_compassu_system_admin(ti.organization_id))); $function$;
CREATE OR REPLACE FUNCTION public.can_create_compassu_admin_invitation(p_role text, p_organization_id uuid DEFAULT NULL::uuid, p_tenant_institution_id uuid DEFAULT NULL::uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
declare v_org_id uuid;
begin
 if auth.uid() is null then return false; end if;
 if p_role='system_admin' then return p_organization_id is not null and p_tenant_institution_id is null and public.is_compassu_master_admin(); end if;
 if p_role not in ('institution_admin','counselor') or p_tenant_institution_id is null then return false; end if;
 select organization_id into v_org_id from public.tenant_institutions where id=p_tenant_institution_id and active;
 if v_org_id is null then return false; end if;
 if p_organization_id is not null and p_organization_id<>v_org_id then return false; end if;
 if p_role='institution_admin' then return public.is_compassu_master_admin() or public.is_compassu_system_admin(v_org_id); end if;
 return public.is_compassu_master_admin() or public.is_compassu_system_admin(v_org_id) or public.is_compassu_institution_admin(p_tenant_institution_id);
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_compassu_admin_context()
 RETURNS TABLE(role text, scope_type text, organization_id uuid, organization_name text, tenant_institution_id uuid, institution_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
 select 'master_admin'::text,'platform'::text,null::uuid,'CompassU'::text,null::uuid,null::text where public.is_compassu_master_admin()
 union all
 select 'system_admin'::text,'organization'::text,o.id,o.name,null::uuid,null::text from public.organization_memberships om join public.organizations o on o.id=om.organization_id where om.user_id=auth.uid() and om.role='system_admin' and om.active and o.active
 union all
 select im.role,'institution'::text,o.id,o.name,ti.id,ti.name from public.institution_memberships im join public.tenant_institutions ti on ti.id=im.tenant_institution_id join public.organizations o on o.id=ti.organization_id where im.user_id=auth.uid() and im.role in ('institution_admin','counselor') and im.active and ti.active and o.active;
$function$;
CREATE OR REPLACE FUNCTION public.get_compassu_admin_invitations()
 RETURNS TABLE(invitation_id uuid, email text, role text, organization_id uuid, organization_name text, tenant_institution_id uuid, institution_name text, status text, expires_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
 select i.id,i.email,i.role,i.organization_id,o.name,i.tenant_institution_id,ti.name,case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,i.expires_at,i.created_at
 from public.admin_role_invitations i left join public.organizations o on o.id=i.organization_id left join public.tenant_institutions ti on ti.id=i.tenant_institution_id
 where auth.uid() is not null and (public.is_compassu_master_admin() or (i.organization_id is not null and public.is_compassu_system_admin(i.organization_id)) or (i.tenant_institution_id is not null and public.is_compassu_institution_admin(i.tenant_institution_id))) order by i.created_at desc;
$function$;
CREATE OR REPLACE FUNCTION public.get_compassu_role_assignments()
 RETURNS TABLE(user_id uuid, email text, role text, active boolean, organization_id uuid, organization_name text, tenant_institution_id uuid, institution_name text, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
 with caller as (select auth.uid() as caller_user_id, public.is_compassu_master_admin() as is_master),
 org_roles as (
  select u.id as user_id,u.email::text as email,om.role as role,om.active as active,o.id as organization_id,o.name as organization_name,null::uuid as tenant_institution_id,null::text as institution_name,om.created_at as created_at
  from public.organization_memberships om join auth.users u on u.id=om.user_id join public.organizations o on o.id=om.organization_id cross join caller c
  where c.is_master or public.is_compassu_system_admin(o.id)
 ),
 institution_roles as (
  select u.id as user_id,u.email::text as email,im.role as role,im.active as active,o.id as organization_id,o.name as organization_name,ti.id as tenant_institution_id,ti.name as institution_name,im.created_at as created_at
  from public.institution_memberships im join auth.users u on u.id=im.user_id join public.tenant_institutions ti on ti.id=im.tenant_institution_id join public.organizations o on o.id=ti.organization_id cross join caller c
  where c.is_master or public.is_compassu_system_admin(o.id) or public.is_compassu_institution_admin(ti.id)
 )
 select * from org_roles union all select * from institution_roles order by 6,8 nulls first,3,2;
$function$;
CREATE OR REPLACE FUNCTION public.stage3a_institution_assignment_readiness()
 RETURNS TABLE(institution_name text, normalized_institution_name text, assigned_accounts integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$ select trim(ai.institution),lower(trim(ai.institution)),count(*)::int from public.account_institutions ai where public.is_compassu_master_admin() and nullif(trim(ai.institution),'') is not null group by trim(ai.institution),lower(trim(ai.institution)); $function$;
CREATE OR REPLACE FUNCTION public.stage3a_tenant_backfill_validation()
 RETURNS TABLE(legacy_assignments integer, linked_assignments integer, unlinked_assignments integer, mismatched_assignments integer, active_organizations integer, active_tenant_institutions integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
 select count(*) filter(where nullif(trim(ai.institution),'') is not null)::int,
 count(*) filter(where nullif(trim(ai.institution),'') is not null and ai.tenant_institution_id is not null)::int,
 count(*) filter(where nullif(trim(ai.institution),'') is not null and ai.tenant_institution_id is null)::int,
 count(*) filter(where ai.tenant_institution_id is not null and lower(trim(ai.institution)) is distinct from ti.normalized_name)::int,
 (select count(*)::int from public.organizations where active),(select count(*)::int from public.tenant_institutions where active)
 from public.account_institutions ai left join public.tenant_institutions ti on ti.id=ai.tenant_institution_id where public.is_compassu_master_admin();
$function$;
REVOKE ALL ON FUNCTION public.is_compassu_system_admin(uuid),public.is_compassu_institution_admin(uuid),public.is_compassu_counselor(uuid),public.can_manage_organization(uuid),public.can_manage_institution(uuid),public.can_create_compassu_admin_invitation(text,uuid,uuid),public.get_compassu_admin_context(),public.get_compassu_admin_invitations(),public.get_compassu_role_assignments() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_compassu_system_admin(uuid),public.is_compassu_institution_admin(uuid),public.is_compassu_counselor(uuid),public.can_manage_organization(uuid),public.can_manage_institution(uuid),public.can_create_compassu_admin_invitation(text,uuid,uuid),public.get_compassu_admin_context(),public.get_compassu_admin_invitations(),public.get_compassu_role_assignments() TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.stage3a_institution_assignment_readiness(),public.stage3a_tenant_backfill_validation() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.stage3a_institution_assignment_readiness(),public.stage3a_tenant_backfill_validation() TO service_role;
commit;;

