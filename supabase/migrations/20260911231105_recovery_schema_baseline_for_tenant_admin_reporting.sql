begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  organization_type text not null default 'institutional_customer' check (organization_type = any (array['institutional_customer'::text,'district'::text,'system'::text,'independent'::text])),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_institutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  catalog_institution_id bigint references public.institutions(id) on delete set null,
  name text not null,
  normalized_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, normalized_name)
);

create table if not exists public.institution_reporting_profiles (
  id uuid primary key default gen_random_uuid(),
  institution text not null unique,
  recipient_emails text[] not null default '{}'::text[],
  active boolean not null default true,
  delivery_day smallint not null default 5 check (delivery_day >= 1 and delivery_day <= 28),
  timezone text not null default 'America/Chicago',
  include_institutional_analytics boolean not null default true,
  include_institutional_trends boolean not null default true,
  include_executive_insights boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_reporting_profiles_recipient_required check (active = false or cardinality(recipient_emails) > 0)
);

create table if not exists public.institution_report_delivery_log (
  id uuid primary key default gen_random_uuid(),
  reporting_profile_id uuid references public.institution_reporting_profiles(id) on delete set null,
  institution text not null,
  reporting_period_start date not null,
  reporting_period_end date not null,
  recipient_emails text[] not null default '{}'::text[],
  status text not null check (status = any (array['scheduled'::text,'generating'::text,'sent'::text,'failed'::text,'skipped'::text])),
  attempt_number integer not null default 1 check (attempt_number > 0),
  provider_message_id text,
  error_message text,
  generated_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (institution, reporting_period_start, attempt_number)
);

create table if not exists public.account_institutions (
  email text primary key,
  institution text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  tenant_institution_id uuid references public.tenant_institutions(id) on delete restrict
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role = 'system_admin'::text),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (user_id, organization_id, role)
);

create table if not exists public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_institution_id uuid not null references public.tenant_institutions(id) on delete cascade,
  role text not null check (role = any (array['institution_admin'::text,'counselor'::text])),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (user_id, tenant_institution_id, role)
);

create table if not exists public.admin_role_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role = any (array['system_admin'::text,'institution_admin'::text,'counselor'::text])),
  organization_id uuid references public.organizations(id) on delete cascade,
  tenant_institution_id uuid references public.tenant_institutions(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status = any (array['pending'::text,'accepted'::text,'revoked'::text,'expired'::text])),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  constraint admin_role_invitation_scope_ck check ((role='system_admin' and organization_id is not null and tenant_institution_id is null) or (role = any (array['institution_admin'::text,'counselor'::text])) and tenant_institution_id is not null)
);

create index if not exists tenant_institutions_organization_idx on public.tenant_institutions(organization_id);
create index if not exists tenant_institutions_catalog_idx on public.tenant_institutions(catalog_institution_id) where catalog_institution_id is not null;
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id) where active;
create index if not exists institution_memberships_user_idx on public.institution_memberships(user_id) where active;
create index if not exists admin_role_invitations_email_idx on public.admin_role_invitations(lower(email));
create index if not exists admin_role_invitations_scope_idx on public.admin_role_invitations(organization_id,tenant_institution_id,status);
create index if not exists institution_reporting_profiles_active_idx on public.institution_reporting_profiles(active,delivery_day);
create index if not exists institution_report_delivery_log_period_idx on public.institution_report_delivery_log(reporting_period_start desc,institution);
create index if not exists account_institutions_institution_idx on public.account_institutions(lower(coalesce(institution,'')));
create index if not exists account_institutions_tenant_institution_id_idx on public.account_institutions(tenant_institution_id);

alter table public.organizations enable row level security;
alter table public.tenant_institutions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.admin_role_invitations enable row level security;
alter table public.institution_reporting_profiles enable row level security;
alter table public.institution_report_delivery_log enable row level security;
alter table public.account_institutions enable row level security;

do $$ begin
if not exists (select 1 from pg_policies where schemaname='public' and tablename='organizations' and policyname='organizations_tenant_read') then create policy organizations_tenant_read on public.organizations for select to authenticated using (can_access_organization(id)); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='tenant_institutions' and policyname='tenant_institutions_tenant_read') then create policy tenant_institutions_tenant_read on public.tenant_institutions for select to authenticated using (can_access_institution(id)); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='organization_memberships' and policyname='organization_memberships_tenant_read') then create policy organization_memberships_tenant_read on public.organization_memberships for select to authenticated using (can_access_organization(organization_id)); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='institution_memberships' and policyname='institution_memberships_tenant_read') then create policy institution_memberships_tenant_read on public.institution_memberships for select to authenticated using (can_access_institution(tenant_institution_id)); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='institution_reporting_profiles' and policyname='Master admin manages monthly reporting profiles') then create policy "Master admin manages monthly reporting profiles" on public.institution_reporting_profiles for all to authenticated using (is_compassu_admin()) with check (is_compassu_admin()); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='institution_report_delivery_log' and policyname='Master admin reads monthly report delivery log') then create policy "Master admin reads monthly report delivery log" on public.institution_report_delivery_log for select to authenticated using (is_compassu_admin()); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='account_institutions' and policyname='admins_read_account_institutions') then create policy admins_read_account_institutions on public.account_institutions for select to authenticated using (is_compassu_admin()); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='account_institutions' and policyname='admins_insert_account_institutions') then create policy admins_insert_account_institutions on public.account_institutions for insert to authenticated with check (is_compassu_admin()); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='account_institutions' and policyname='admins_update_account_institutions') then create policy admins_update_account_institutions on public.account_institutions for update to authenticated using (is_compassu_admin()) with check (is_compassu_admin()); end if;
end $$;

revoke all on public.admin_role_invitations from anon, authenticated;
grant all on public.admin_role_invitations to service_role;
revoke all on public.organization_memberships from anon, authenticated;
grant select, truncate, references, trigger on public.organization_memberships to authenticated;
grant all on public.organization_memberships to service_role;
revoke all on public.institution_memberships from anon, authenticated;
grant select, truncate, references, trigger on public.institution_memberships to authenticated;
grant all on public.institution_memberships to service_role;
revoke all on public.institution_report_delivery_log from anon, authenticated;
grant select on public.institution_report_delivery_log to authenticated;
grant all on public.institution_report_delivery_log to service_role;
revoke all on public.institution_reporting_profiles from anon, authenticated;
grant select, insert, update on public.institution_reporting_profiles to authenticated;
grant all on public.institution_reporting_profiles to service_role;
grant all on public.organizations to authenticated, service_role;
grant all on public.tenant_institutions to authenticated, service_role;
grant all on public.account_institutions to anon, authenticated, service_role;

commit;