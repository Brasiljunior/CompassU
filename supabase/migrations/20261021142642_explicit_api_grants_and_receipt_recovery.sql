set local lock_timeout = '5s';
-- Server-only receipt metadata and a private, size-limited storage bucket.
create table if not exists public.finance_expense_receipts (
 id uuid primary key default gen_random_uuid(), expense_id uuid not null unique references public.finance_expenses(id),
 object_path text not null unique check(object_path like expense_id::text || '/%'),
 file_name text not null check(length(file_name) between 1 and 180),
 content_type text not null check(content_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes integer not null check(size_bytes between 1 and 3145728),
 uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists finance_expense_receipts_uploaded_by on public.finance_expense_receipts(uploaded_by);
alter table public.finance_expense_receipts enable row level security;
drop policy if exists finance_receipts_server_only on public.finance_expense_receipts;
create policy finance_receipts_server_only on public.finance_expense_receipts for all to anon,authenticated using(false) with check(false);
revoke all on public.finance_expense_receipts from public,anon,authenticated;
grant all on public.finance_expense_receipts to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('finance-receipts','finance-receipts',false,3145728,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create or replace function public.finance_register_receipt(p_expense uuid,p_path text,p_name text,p_type text,p_size integer,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare result jsonb;begin
 if p_actor is null or not exists(select 1 from admin_users where user_id=p_actor and role='master_admin') then raise exception 'Master administrator required';end if;
 insert into finance_expense_receipts(expense_id,object_path,file_name,content_type,size_bytes,uploaded_by)
 values(p_expense,p_path,p_name,p_type,p_size,p_actor) returning to_jsonb(finance_expense_receipts.*) into result;
 insert into finance_audit(actor,action,record_id,details) values(p_actor,'attach_receipt',p_expense,jsonb_build_object('file_name',p_name,'size_bytes',p_size));
 return result;
end $$;
revoke all on function public.finance_register_receipt(uuid,text,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.finance_register_receipt(uuid,text,text,text,integer,uuid) to service_role;

-- Explicit current table manifest; future tables require their own grants.
grant select, insert, update, delete on public.account_institutions, public.admin_audit_log, public.admin_role_invitations, public.admin_users, public.assessment_attempts, public.assessment_questions, public.assessment_responses, public.batch_invitation_report_items, public.batch_invitation_reports, public.career_clusters, public.cip_catalog, public.finance_audit, public.finance_customers, public.finance_deliveries, public.finance_expense_receipts, public.finance_expenses, public.finance_invoices, public.finance_payments, public.finance_settings, public.institution_majors, public.institution_memberships, public.institution_report_delivery_log, public.institution_reporting_profiles, public.institutions, public.invitation_reminders, public.major_cluster_weights, public.major_matches, public.major_occupations, public.major_trait_weights, public.majors, public.occupations, public.organization_memberships, public.organizations, public.profiles, public.question_trait_weights, public.scoring_traits, public.tenant_institutions, public.user_major_favorites to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq,public.assessment_questions_id_seq,public.batch_invitation_report_items_id_seq,public.finance_audit_id_seq,public.finance_invoice_number,public.majors_id_seq,public.occupations_id_seq to service_role;

-- RLS does not protect TRUNCATE. Browser roles never need DDL-like privileges.
revoke truncate, references, trigger, maintain on all tables in schema public from public, anon, authenticated;
-- Adopt the upcoming table/sequence defaults for postgres-created objects now.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
