-- Transactional permissions smoke test for staging; always rolls back.
-- Must run using a privileged migration role, never a browser connection.
begin;
revoke insert, update on public.assessment_attempts from authenticated;
grant insert(user_id) on public.assessment_attempts to authenticated;
do $$
begin
  if not has_column_privilege('authenticated','public.assessment_attempts','user_id','INSERT') then
    raise exception 'Authenticated users cannot create own assessment';
  end if;
  if has_column_privilege('authenticated','public.assessment_attempts','status','INSERT')
    or has_column_privilege('authenticated','public.assessment_attempts','completed_at','INSERT')
    or has_column_privilege('authenticated','public.assessment_attempts','status','UPDATE')
    or has_column_privilege('authenticated','public.assessment_attempts','user_id','UPDATE')
  then raise exception 'Untrusted assessment completion or ownership write remains possible'; end if;
end;
$$;
rollback;
