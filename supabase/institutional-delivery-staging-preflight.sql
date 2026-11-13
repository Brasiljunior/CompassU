-- READ ONLY. Run against isolated staging before reviewing draft migrations.
-- Does not install tables, create affiliations, grant access, or send email.
select
  to_regclass('public.assessment_attempts') is not null as assessment_attempts_present,
  to_regclass('public.tenant_institutions') is not null as tenant_institutions_present,
  to_regclass('public.institution_memberships') is not null as staff_memberships_present,
  to_regclass('public.institution_assessment_affiliations') is not null as assessment_affiliations_installed,
  to_regclass('public.institution_assessment_delivery_settings') is not null as delivery_settings_installed,
  to_regclass('public.institution_assessment_recipients') is not null as recipients_installed,
  to_regclass('public.institution_assessment_authorizations') is not null as authorizations_installed,
  to_regclass('public.institution_assessment_delivery_jobs') is not null as delivery_jobs_installed;

-- Verify the columns required by the draft migrations without reading student data.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'assessment_attempts' and column_name in ('id', 'user_id', 'status', 'completed_at'))
    or (table_name = 'tenant_institutions' and column_name in ('id', 'name'))
    or (table_name = 'institution_memberships' and column_name in ('user_id', 'tenant_institution_id', 'active')))
order by table_name, column_name;

-- These checks are structural only. A passing result does NOT establish
-- verified student affiliation, consent, successful CI, or permission to send.
