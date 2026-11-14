-- DRAFT: staging-only trusted student affiliation assignment.
-- Never populate from account_institutions.email, browser parameters, or staff membership.
-- Assignments must be written by a privileged, independently verified onboarding process.
-- Not applied. No historical backfill.
create table if not exists public.institution_student_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_institution_id uuid not null references public.tenant_institutions(id),
  evidence_reference text not null check (nullif(btrim(evidence_reference),'') is not null),
  verified_at timestamptz not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id)
);
alter table public.institution_student_assignments enable row level security;
revoke all on public.institution_student_assignments from anon, authenticated;

-- Capture the verified student assignment only during the initial transition
-- to completed, within the same transaction. Missing evidence leaves the
-- assessment completed but ineligible for institutional delivery.
-- A trigger cannot establish independent report-sharing consent.
create or replace function public.capture_institution_assessment_affiliation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  v_assignment record;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select a.tenant_institution_id, a.evidence_reference, a.assigned_by
      into v_assignment
      from public.institution_student_assignments a
      where a.user_id = new.user_id
        and a.verified_at is not null
        and nullif(pg_catalog.btrim(a.evidence_reference),'') is not null;
    if found then
      insert into public.institution_assessment_affiliations
        (attempt_id,tenant_institution_id,evidence_reference,recorded_by)
      values (new.id,v_assignment.tenant_institution_id,
              v_assignment.evidence_reference,v_assignment.assigned_by);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_institution_assessment_affiliation()
  from public, anon, authenticated;
-- IMPORTANT: Do not install the trigger until finalize_assessment has been
-- reviewed for privileges. SECURITY INVOKER trigger inherits caller rights;
-- authenticated students cannot insert into the restricted snapshot table.
-- Implement the snapshot through a narrowly scoped trusted transaction
-- after reviewing the completion RPC, rather than granting students write access.
