create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'master_admin' check (role in ('master_admin','administrator')),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

alter table public.admin_users enable row level security;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_user_id uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_admin_user_id_idx on public.admin_audit_log(admin_user_id);
alter table public.admin_audit_log enable row level security;;


-- Explicit server access for replay without automatic Data API grants.
grant select, insert, update, delete on public.admin_users, public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;
