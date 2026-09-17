-- Permanently remove a monthly reporting configuration while preserving
-- historical delivery log rows (their reporting_profile_id becomes null).

create or replace function public.delete_institution_monthly_reporting_profile(
  p_institution text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null or not public.is_compassu_admin() then
    raise exception 'Master administrator access required';
  end if;

  if nullif(trim(p_institution), '') is null then
    raise exception 'Institution is required';
  end if;

  delete from public.institution_reporting_profiles
  where institution = trim(p_institution);

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.delete_institution_monthly_reporting_profile(text) from public, anon;
grant execute on function public.delete_institution_monthly_reporting_profile(text) to authenticated;

comment on function public.delete_institution_monthly_reporting_profile(text) is
  'Deletes one Master Administrator monthly reporting configuration without deleting delivery history.';
