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

-- A verified assignment is a provenance record, not a mutable account preference.
-- Changes require an explicitly audited revocation/reassignment workflow.
create or replace function public.prevent_institution_student_assignment_update()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception 'Verified institutional student assignment is immutable';
end;
$$;
revoke all on function public.prevent_institution_student_assignment_update()
  from public, anon, authenticated;
drop trigger if exists prevent_institution_student_assignment_update
  on public.institution_student_assignments;
create trigger prevent_institution_student_assignment_update
before update on public.institution_student_assignments
for each row execute function public.prevent_institution_student_assignment_update();

-- Completion-time snapshot integration is intentionally NOT installed here.
-- finalize_assessment is SECURITY INVOKER and runs with student permissions.
-- A SECURITY INVOKER trigger attempting to insert into the restricted
-- institution_assessment_affiliations table would raise permission denied,
-- rolling back a legitimate student's assessment completion.
--
-- Do not grant authenticated users INSERT on the snapshot table.
-- Do not replace this with a broadly executable SECURITY DEFINER RPC.
-- Implement a narrow, reviewed trusted transaction after provenance and
-- independent consent requirements have been validated in staging.
-- No assessment-completion trigger, snapshot function, or backfill is created
-- by this assignment draft. The assignment UPDATE guard above is intentional.
