begin;
CREATE OR REPLACE FUNCTION public.create_compassu_admin_invitation(p_email text, p_role text, p_organization_id uuid DEFAULT NULL::uuid, p_tenant_institution_id uuid DEFAULT NULL::uuid, p_expires_days integer DEFAULT 7)
 RETURNS TABLE(invitation_id uuid, invitation_token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
declare
 v_email text:=lower(trim(coalesce(p_email,'')));
 v_token text; v_hash text; v_org_id uuid:=p_organization_id; v_id uuid; v_expires timestamptz;
begin
 if auth.uid() is null then raise exception 'Administrator login required.'; end if;
 if v_email='' or position('@' in v_email)=0 then raise exception 'A valid email address is required.'; end if;
 if p_expires_days<1 or p_expires_days>30 then raise exception 'Invitation expiration must be between 1 and 30 days.'; end if;
 if p_tenant_institution_id is not null then select organization_id into v_org_id from public.tenant_institutions where id=p_tenant_institution_id and active; end if;
 if not public.can_create_compassu_admin_invitation(p_role,v_org_id,p_tenant_institution_id) then raise exception 'You are not authorized to invite this administrator role for the selected scope.'; end if;
 update public.admin_role_invitations set status='expired' where status='pending' and expires_at<=now();
 update public.admin_role_invitations set status='revoked' where status='pending' and lower(email)=v_email and role=p_role and organization_id is not distinct from v_org_id and tenant_institution_id is not distinct from p_tenant_institution_id;
 v_token:=encode(gen_random_bytes(32),'hex');
 v_hash:=encode(digest(v_token,'sha256'),'hex');
 v_expires:=now()+make_interval(days=>p_expires_days);
 insert into public.admin_role_invitations(email,role,organization_id,tenant_institution_id,token_hash,status,expires_at,created_by)
 values(v_email,p_role,v_org_id,p_tenant_institution_id,v_hash,'pending',v_expires,auth.uid()) returning id into v_id;
 return query select v_id,v_token,v_expires;
end;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_compassu_admin_invitation(p_invitation_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
declare v_inv public.admin_role_invitations%rowtype;
begin
 if auth.uid() is null then raise exception 'Administrator login required.'; end if;
 select * into v_inv from public.admin_role_invitations where id=p_invitation_id;
 if v_inv.id is null then raise exception 'Invitation not found.'; end if;
 if not public.can_create_compassu_admin_invitation(v_inv.role,v_inv.organization_id,v_inv.tenant_institution_id) then raise exception 'You are not authorized to revoke this invitation.'; end if;
 update public.admin_role_invitations set status='revoked' where id=p_invitation_id and status='pending';
 return 'Administrator invitation revoked.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_compassu_admin_invitation(p_token text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
declare
 v_hash text:=encode(digest(coalesce(p_token,''),'sha256'),'hex');
 v_inv public.admin_role_invitations%rowtype;
 v_user_email text;
begin
 if auth.uid() is null then raise exception 'Sign in to CompassU before accepting this invitation.'; end if;
 select lower(email) into v_user_email from auth.users where id=auth.uid();
 if v_user_email is null then raise exception 'Unable to verify the signed-in CompassU account.'; end if;
 select * into v_inv from public.admin_role_invitations where token_hash=v_hash for update;
 if v_inv.id is null then raise exception 'This administrator invitation is invalid.'; end if;
 if v_inv.status<>'pending' then raise exception 'This administrator invitation is no longer active.'; end if;
 if v_inv.expires_at<=now() then update public.admin_role_invitations set status='expired' where id=v_inv.id; raise exception 'This administrator invitation has expired.'; end if;
 if lower(v_inv.email)<>v_user_email then raise exception 'This invitation was issued to a different email address.'; end if;
 if v_inv.role='system_admin' then
   insert into public.organization_memberships(user_id,organization_id,role,active,created_by)
   values(auth.uid(),v_inv.organization_id,'system_admin',true,v_inv.created_by)
   on conflict(user_id,organization_id,role) do update set active=true;
 else
   insert into public.institution_memberships(user_id,tenant_institution_id,role,active,created_by)
   values(auth.uid(),v_inv.tenant_institution_id,v_inv.role,true,v_inv.created_by)
   on conflict(user_id,tenant_institution_id,role) do update set active=true;
 end if;
 update public.admin_role_invitations set status='accepted',accepted_at=now(),accepted_by=auth.uid() where id=v_inv.id;
 return case v_inv.role when 'system_admin' then 'System / District Administrator access activated.' when 'institution_admin' then 'Institution Administrator access activated.' else 'Counselor / Advisor access activated.' end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_compassu_admin_membership(p_user_email text, p_role text, p_organization_id uuid DEFAULT NULL::uuid, p_tenant_institution_id uuid DEFAULT NULL::uuid, p_active boolean DEFAULT true)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
declare
 v_user_id uuid; v_org_id uuid; v_email text:=lower(trim(coalesce(p_user_email,'')));
begin
 if auth.uid() is null then raise exception 'Administrator login required.'; end if;
 if v_email='' then raise exception 'User email is required.'; end if;
 if p_role not in ('system_admin','institution_admin','counselor') then raise exception 'Unsupported administrator role.'; end if;
 select id into v_user_id from auth.users where lower(email)=v_email limit 1;
 if v_user_id is null then raise exception 'No CompassU account exists for that email address.'; end if;
 if p_role='system_admin' then
   if p_organization_id is null or p_tenant_institution_id is not null then raise exception 'System Administrator requires an organization scope.'; end if;
   if not public.is_compassu_master_admin() then raise exception 'Only a CompassU Master Administrator can manage System Administrators.'; end if;
   if not exists(select 1 from public.organizations where id=p_organization_id and active) then raise exception 'Organization not found or inactive.'; end if;
   update public.organization_memberships set active=false where user_id=v_user_id and organization_id=p_organization_id and role='system_admin' and active and not p_active;
   if p_active then
     insert into public.organization_memberships(user_id,organization_id,role,active,created_by)
     values(v_user_id,p_organization_id,'system_admin',true,auth.uid())
     on conflict(user_id,organization_id,role) do update set active=true,created_by=auth.uid();
   end if;
   return case when p_active then 'System Administrator access activated.' else 'System Administrator access deactivated.' end;
 end if;
 if p_tenant_institution_id is null then raise exception 'Institution-scoped role requires an institution.'; end if;
 select organization_id into v_org_id from public.tenant_institutions where id=p_tenant_institution_id and active;
 if v_org_id is null then raise exception 'Institution not found or inactive.'; end if;
 if p_organization_id is not null and p_organization_id is distinct from v_org_id then raise exception 'Institution does not belong to the selected organization.'; end if;
 if p_role='institution_admin' then
   if not (public.is_compassu_master_admin() or public.is_compassu_system_admin(v_org_id)) then raise exception 'You are not authorized to manage Institution Administrators for this institution.'; end if;
 elsif p_role='counselor' then
   if not (public.is_compassu_master_admin() or public.is_compassu_system_admin(v_org_id) or public.is_compassu_institution_admin(p_tenant_institution_id)) then raise exception 'You are not authorized to manage Counselors/Advisors for this institution.'; end if;
 end if;
 if p_active then
   update public.institution_memberships set active=false where user_id=v_user_id and tenant_institution_id=p_tenant_institution_id and role<>p_role and active;
   insert into public.institution_memberships(user_id,tenant_institution_id,role,active,created_by)
   values(v_user_id,p_tenant_institution_id,p_role,true,auth.uid())
   on conflict(user_id,tenant_institution_id,role) do update set active=true,created_by=auth.uid();
 else
   update public.institution_memberships set active=false where user_id=v_user_id and tenant_institution_id=p_tenant_institution_id and role=p_role and active;
 end if;
 return case when p_active and p_role='institution_admin' then 'Institution Administrator access activated.' when p_active and p_role='counselor' then 'Counselor/Advisor access activated.' when not p_active and p_role='institution_admin' then 'Institution Administrator access deactivated.' else 'Counselor/Advisor access deactivated.' end;
end;
$function$;

REVOKE ALL ON FUNCTION public.create_compassu_admin_invitation(text,text,uuid,uuid,integer),public.revoke_compassu_admin_invitation(uuid),public.accept_compassu_admin_invitation(text),public.set_compassu_admin_membership(text,text,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_compassu_admin_invitation(text,text,uuid,uuid,integer),public.revoke_compassu_admin_invitation(uuid),public.accept_compassu_admin_invitation(text),public.set_compassu_admin_membership(text,text,uuid,uuid,boolean) TO authenticated,service_role;
commit;;

