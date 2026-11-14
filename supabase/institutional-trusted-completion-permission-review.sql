-- REVIEW DRAFT — DO NOT APPLY WITHOUT TESTING EXISTING ASSESSMENT WRITES.
-- Current staging policy users_update_own_attempts allows authenticated owners
-- to update status/completed_at directly, bypassing finalize_assessment.
-- Removing this policy wholesale would break SECURITY INVOKER finalize_assessment.
--
-- Candidate defense: revoke authenticated UPDATE on sensitive completion columns
-- while retaining necessary legitimate updates; however SECURITY INVOKER
-- finalize_assessment also needs those column permissions, so this cannot be
-- applied alone. A narrowly scoped privileged completion RPC with explicit
-- auth.uid() ownership, >=80 response validation and score computation must
-- replace the current RPC before any column privilege revocation.
--
-- No triggers on status changes until direct client completion is impossible.
-- No client-provided tenant id or student id accepted for snapshot capture.
-- Snapshot insertion must be transactionally tied to trusted completion.
--
-- Verification queries (read only):
select column_name, privilege_type, grantee
from information_schema.column_privileges
where table_schema='public'
  and table_name='assessment_attempts'
  and grantee in ('authenticated','anon')
order by column_name, privilege_type;
select policyname, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename='assessment_attempts';
