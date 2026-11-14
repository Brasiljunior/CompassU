-- Phase 2 read-only staging readiness report. Safe to run before migrations.
-- Never treat mutable account email or staff membership as student affiliation.
select
  to_regclass('public.assessment_attempts') is not null as assessments_present,
  to_regclass('public.tenant_institutions') is not null as tenants_present,
  to_regclass('public.institution_assessment_affiliations') is not null as immutable_affiliations_present,
  to_regclass('public.institution_assessment_delivery_settings') is not null as delivery_settings_present,
  to_regclass('public.institution_assessment_recipients') is not null as recipients_present,
  to_regclass('public.institution_assessment_authorizations') is not null as per_attempt_authorizations_present,
  to_regclass('public.institution_assessment_delivery_jobs') is not null as delivery_jobs_present,
  (select count(*) from public.assessment_attempts where status='completed') as historical_completed_attempts;
-- A missing table is a BLOCKER, not permission to use historical assessments.
