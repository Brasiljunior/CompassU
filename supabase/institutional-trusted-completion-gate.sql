-- READ-ONLY staging security gate. This must NOT mutate data or send email.
-- Gate is intentionally FAIL until direct client completion is prevented.
with checks as (
  select
    has_table_privilege('authenticated','public.assessment_attempts','UPDATE') as direct_attempt_update,
    has_column_privilege('authenticated','public.assessment_attempts','status','UPDATE') as direct_status_update,
    has_column_privilege('authenticated','public.assessment_attempts','completed_at','UPDATE') as direct_completion_timestamp_update,
    has_column_privilege('authenticated','public.assessment_attempts','user_id','UPDATE') as direct_owner_update,
    exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='assessment_attempts'
        and cmd='UPDATE' and policyname='users_update_own_attempts'
    ) as owner_update_policy_present,
    (select prosecdef from pg_proc
      where oid = to_regprocedure('public.finalize_assessment(uuid)')) as finalize_security_definer
)
select *,
  (not direct_status_update
    and not direct_completion_timestamp_update
    and not direct_owner_update
    and finalize_security_definer is true) as trusted_completion_gate_passes
from checks;
