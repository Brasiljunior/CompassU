-- Draft only: apply to isolated test project after review.
-- Delivery and recipients are disabled by default.
create table if not exists public.institution_assessment_delivery_settings (
  tenant_institution_id uuid primary key references public.tenant_institutions(id) on delete cascade,
  enabled boolean not null default false,
  report_mode text not null default 'both' check (report_mode in ('full','summary','both')),
  authorization_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_enabled_requires_authorization
    check (not enabled or nullif(btrim(authorization_reference),'') is not null)
);

create table if not exists public.institution_assessment_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_institution_id uuid not null references public.tenant_institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  email text not null,
  display_name text,
  active boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, tenant_institution_id),
  unique (tenant_institution_id, user_id),
  constraint recipient_valid_email
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  constraint recipient_active_requires_verification
    check (not active or verified_at is not null)
);

create unique index if not exists institution_assessment_recipients_unique_email
  on public.institution_assessment_recipients (tenant_institution_id, lower(email));

create table if not exists public.institution_assessment_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  tenant_institution_id uuid not null references public.tenant_institutions(id) on delete cascade,
  recipient_id uuid not null,
  report_type text not null check (report_type in ('full','summary')),
  status text not null default 'queued'
    check (status in ('queued','processing','sent','failed','skipped')),
  retry_count integer not null default 0 check (retry_count >= 0),
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  claimed_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  constraint delivery_sent_requires_provider_id
    check (status <> 'sent' or (provider_message_id is not null and sent_at is not null)),
  unique (attempt_id,tenant_institution_id,recipient_id,report_type),
  foreign key (recipient_id,tenant_institution_id)
    references public.institution_assessment_recipients(id,tenant_institution_id)
);

create index if not exists institution_assessment_jobs_status_idx
  on public.institution_assessment_delivery_jobs(status,next_attempt_at,created_at);

alter table public.institution_assessment_authorizations enable row level security;
alter table public.institution_assessment_delivery_settings enable row level security;
alter table public.institution_assessment_recipients enable row level security;
alter table public.institution_assessment_delivery_jobs enable row level security;

-- No public client access; privileged server operations only.
revoke all on public.institution_assessment_authorizations from anon,authenticated;
revoke all on public.institution_assessment_delivery_settings from anon,authenticated;
revoke all on public.institution_assessment_recipients from anon,authenticated;
revoke all on public.institution_assessment_delivery_jobs from anon,authenticated;
