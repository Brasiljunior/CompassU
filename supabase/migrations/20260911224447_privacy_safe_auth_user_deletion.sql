
begin;

do $$
begin
  if to_regclass('public.admin_audit_log') is not null then
    alter table public.admin_audit_log alter column admin_user_id drop not null;
    alter table public.admin_audit_log drop constraint if exists admin_audit_log_admin_user_id_fkey;
    alter table public.admin_audit_log add constraint admin_audit_log_admin_user_id_fkey foreign key (admin_user_id) references auth.users(id) on delete set null;

    update public.admin_audit_log l set target_user_id=null
    where target_user_id is not null and not exists (select 1 from auth.users u where u.id=l.target_user_id);

    alter table public.admin_audit_log drop constraint if exists admin_audit_log_target_user_id_fkey;
    alter table public.admin_audit_log add constraint admin_audit_log_target_user_id_fkey foreign key (target_user_id) references auth.users(id) on delete set null;
  end if;

  if to_regclass('public.admin_role_invitations') is not null then
    alter table public.admin_role_invitations alter column created_by drop not null;
    alter table public.admin_role_invitations drop constraint if exists admin_role_invitations_created_by_fkey;
    alter table public.admin_role_invitations add constraint admin_role_invitations_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
    alter table public.admin_role_invitations drop constraint if exists admin_role_invitations_accepted_by_fkey;
    alter table public.admin_role_invitations add constraint admin_role_invitations_accepted_by_fkey foreign key (accepted_by) references auth.users(id) on delete set null;
  end if;

  if to_regclass('public.batch_invitation_reports') is not null then
    alter table public.batch_invitation_reports alter column created_by drop not null;
    alter table public.batch_invitation_reports drop constraint if exists batch_invitation_reports_created_by_fkey;
    alter table public.batch_invitation_reports add constraint batch_invitation_reports_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
  end if;

  if to_regclass('public.institution_memberships') is not null then
    alter table public.institution_memberships drop constraint if exists institution_memberships_created_by_fkey;
    alter table public.institution_memberships add constraint institution_memberships_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
  end if;

  if to_regclass('public.organization_memberships') is not null then
    alter table public.organization_memberships drop constraint if exists organization_memberships_created_by_fkey;
    alter table public.organization_memberships add constraint organization_memberships_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
  end if;
end $$;

commit;
;

