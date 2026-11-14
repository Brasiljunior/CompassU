-- NOT APPLIED. Review and test in isolated staging before any migration.
-- Enables the 'full' report type in existing delivery settings/jobs.
-- Existing institution settings remain disabled unless separately authorized.
-- This migration alone does not send emails or activate a worker.
begin;
alter table public.institution_assessment_delivery_settings
  drop constraint if exists institution_assessment_delivery_settings_report_mode_check;
alter table public.institution_assessment_delivery_settings
  add constraint institution_assessment_delivery_settings_report_mode_check
  check (report_mode in ('summary','full'));
alter table public.institution_assessment_delivery_jobs
  drop constraint if exists institution_assessment_delivery_jobs_report_type_check;
alter table public.institution_assessment_delivery_jobs
  add constraint institution_assessment_delivery_jobs_report_type_check
  check (report_type in ('summary','full'));
commit;
