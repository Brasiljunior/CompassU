do $$
declare v_schema text;
begin
  select n.nspname into v_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
  if v_schema is null then
    execute 'create extension pg_trgm with schema extensions';
  elsif v_schema <> 'extensions' then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end $$;;

