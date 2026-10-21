
do $$
begin
  if to_regprocedure('public.stage3a_institution_assignment_readiness()') is not null then
    execute 'revoke execute on function public.stage3a_institution_assignment_readiness() from authenticated';
  end if;
  if to_regprocedure('public.stage3a_tenant_backfill_validation()') is not null then
    execute 'revoke execute on function public.stage3a_tenant_backfill_validation() from authenticated';
  end if;
end $$;
;

