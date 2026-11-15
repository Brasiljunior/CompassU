-- Institutional authorization is separate from student-controlled disclosure preferences.
-- A recipient address alone does not establish authorization to disclose student results.
-- Only privileged server/admin processes may manage these records.
create table if not exists public.institution_assessment_delivery_authorizations (
 institution_name text primary key,
 approved boolean not null default false,
 approved_at timestamptz,
 revoked_at timestamptz,
 authorization_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint institution_delivery_authorization_consistency check (
   (approved = false) or
   (approved_at is not null and revoked_at is null
     and nullif(btrim(authorization_reference),'') is not null)
 )
);
alter table public.institution_assessment_delivery_authorizations enable row level security;
revoke all on public.institution_assessment_delivery_authorizations from public, anon, authenticated;
-- Do not seed approvals from recipient configuration. An authorized institutional
-- agreement/notice must be verified and recorded independently before enabling.
