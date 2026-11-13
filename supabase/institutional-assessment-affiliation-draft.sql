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

-- Composite key allows downstream records to reference the same tenant as the attempt.
create unique index if not exists institution_assessment_affiliations_attempt_tenant_key
  on public.institution_assessment_affiliations(attempt_id,tenant_institution_id);

create index if not exists institution_assessment_affiliations_tenant_idx
  on public.institution_assessment_affiliations(tenant_institution_id);

alter table public.institution_assessment_affiliations enable row level security;
revoke all on public.institution_assessment_affiliations from anon, authenticated;

-- A primary key alone does not prevent UPDATE reassignment.
create or replace function public.prevent_institution_assessment_affiliation_reassignment()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.attempt_id is distinct from old.attempt_id
    or new.tenant_institution_id is distinct from old.tenant_institution_id
    or new.evidence_reference is distinct from old.evidence_reference
    or new.recorded_at is distinct from old.recorded_at
    or new.recorded_by is distinct from old.recorded_by then
    raise exception 'Assessment institutional affiliation cannot be reassigned';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_institution_assessment_affiliation_reassignment()
  from public, anon, authenticated;
drop trigger if exists prevent_institution_assessment_affiliation_reassignment
  on public.institution_assessment_affiliations;
create trigger prevent_institution_assessment_affiliation_reassignment
before update on public.institution_assessment_affiliations
for each row execute function public.prevent_institution_assessment_affiliation_reassignment();

-- Privileged deletion remains possible for retention and privacy workflows.
-- This schema does not establish consent or grant report access.
