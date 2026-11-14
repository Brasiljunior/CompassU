-- Rollback-only trusted finalization ownership test.
-- SQL role/JWT claim simulation is not a substitute for a signed JWT HTTP test.
-- Requires the cutover draft to be loaded in the same transaction.
begin;
-- Paste the reviewed institutional-trusted-finalization-cutover-DRAFT.sql
-- here when executing in a SQL console, before the assertions below.
-- Never run against production.
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',true);
do $test$
begin
  begin
    perform * from public.finalize_assessment(
      '00000000-0000-0000-0000-000000000002'::uuid);
    raise exception 'Expected ownership rejection did not occur';
  exception when others then
    if sqlerrm <> 'Assessment attempt not found' then raise; end if;
  end;
end;
$test$;
rollback;
