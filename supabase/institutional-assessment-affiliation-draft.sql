-- DRAFT ONLY. Do not apply until student affiliation capture and authorization
-- workflows have passed staging review. No backfill from email or staff roles.
--
-- An assessment's institutional affiliation must be recorded by a trusted
-- server process at assessment completion, not inferred later from mutable
-- account_institutions.email or institution_memberships staff roles.
create table if not exists public.institution_assessment_affiliations (
  attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
  tenant_institution_id uuid not null references public.tenant_institutions(id),
  recorded_at timestamptz not null default now(),
  evidence_reference text not null
    check (nullif(btrim(evidence_reference), '') is not null),
  recorded_by uuid references auth.users(id)
);

create index if not exists institution_assessment_affiliations_tenant_idx
  on public.institution_assessment_affiliations(tenant_institution_id);

alter table public.institution_assessment_affiliations enable row level security;
revoke all on public.institution_assessment_affiliations from anon, authenticated;

-- The primary key ensures one tenant per attempt. The application must
-- prohibit reassignment after capture and verify institutional authorization
-- independently; this schema does not establish consent or grant report access.
