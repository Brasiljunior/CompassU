-- Institutional complete-report delivery storage.
-- Apply only with a trusted report generator and delivery worker.
-- No client role can read, insert, or update these student records.
create table if not exists public.institution_assessment_full_report_snapshots (
 attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
 student_user_id uuid not null references auth.users(id),
 tenant_institution_id uuid,
 completed_at timestamptz not null,
 student_name text not null,
 institution_name text not null,
 sections jsonb not null,
 report_schema_version integer not null default 1,
 created_at timestamptz not null default now(),
 constraint full_report_sections_object check (jsonb_typeof(sections)='object')
);
alter table public.institution_assessment_full_report_snapshots enable row level security;
revoke all on public.institution_assessment_full_report_snapshots from public, anon, authenticated;

create table if not exists public.institution_assessment_delivery_jobs (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
 recipient_email text not null,
 institution_name text not null,
 status text not null default 'pending'
   check(status in ('pending','processing','sent','failed','blocked')),
 provider_message_id text,
 attempts integer not null default 0,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 sent_at timestamptz,
 unique(attempt_id,recipient_email)
);
alter table public.institution_assessment_delivery_jobs enable row level security;
revoke all on public.institution_assessment_delivery_jobs from public, anon, authenticated;
create index if not exists institution_assessment_delivery_jobs_pending_idx
 on public.institution_assessment_delivery_jobs(created_at) where status='pending';
