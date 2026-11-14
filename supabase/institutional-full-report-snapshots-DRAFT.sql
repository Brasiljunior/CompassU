-- DRAFT ONLY. Do not apply to production without approval.
-- Full institutional report snapshots are produced by trusted server-side
-- assessment finalization, never supplied by a browser.
create table if not exists public.institution_assessment_full_report_snapshots (
  attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
  student_user_id uuid not null references auth.users(id),
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
    and length(btrim(sections->>'personalityTraits')) > 0
    and length(btrim(sections->>'careerClusters')) > 0
    and length(btrim(sections->>'recommendedMajors')) > 0
    and length(btrim(sections->>'careerOptions')) > 0
    and length(btrim(sections->>'academicStrengths')) > 0
    and length(btrim(sections->>'values')) > 0
    and length(btrim(sections->>'collegeDestinations')) > 0
    and length(btrim(sections->>'recommendedCourses')) > 0
    and length(btrim(sections->>'whyThisPathPointsNorth')) > 0
  ),
  report_schema_version integer not null default 1 check (report_schema_version = 1),
  generated_at timestamptz not null default now()
);
alter table public.institution_assessment_full_report_snapshots enable row level security;
-- No anon/authenticated access policies: only trusted service role may read.
revoke all on public.institution_assessment_full_report_snapshots from anon, authenticated;
-- Application code must verify attempt owner, completion, tenant affiliation,
-- and authorization before loading this snapshot.
