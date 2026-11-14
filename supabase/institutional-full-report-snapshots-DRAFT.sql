-- DRAFT ONLY. Do not apply to production without approval.
-- Full institutional report snapshots are produced by trusted server-side
-- assessment finalization, never supplied by a browser.
create table if not exists public.institution_assessment_full_report_snapshots (
  attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
  student_user_id uuid not null,
  tenant_institution_id uuid not null references public.tenant_institutions(id),
  completed_at timestamptz not null,
  student_name text not null check (length(trim(student_name)) between 1 and 500),
  institution_name text not null check (length(trim(institution_name)) between 1 and 500),
  sections jsonb not null check (
    jsonb_typeof(sections) = 'object'
    and sections ?& array[
      'personalityTraits','careerClusters','recommendedMajors','careerOptions',
      'academicStrengths','values','collegeDestinations','recommendedCourses',
      'whyThisPathPointsNorth'
    ]
  ),
  report_version text not null,
  created_at timestamptz not null default now()
);
alter table public.institution_assessment_full_report_snapshots enable row level security;
-- No anon/authenticated access policies: only trusted service role may read.
revoke all on public.institution_assessment_full_report_snapshots from anon, authenticated;
-- Application code must verify attempt owner, completion, tenant affiliation,
-- and authorization before loading this snapshot.
