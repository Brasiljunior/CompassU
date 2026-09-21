alter table public.account_institutions
  add column if not exists institution_type text not null default 'high_school',
  add column if not exists catalog_institution_id bigint references public.institutions(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'account_institutions_institution_type_check'
  ) then
    alter table public.account_institutions
      add constraint account_institutions_institution_type_check
      check (institution_type in ('high_school','community_college','university'));
  end if;
end $$;

update public.account_institutions ai
set catalog_institution_id=ti.catalog_institution_id
from public.tenant_institutions ti
where ai.tenant_institution_id=ti.id
  and ai.catalog_institution_id is null
  and ti.catalog_institution_id is not null;

create index if not exists account_institutions_catalog_institution_idx
  on public.account_institutions(catalog_institution_id)
  where catalog_institution_id is not null;

comment on column public.account_institutions.institution_type is
  'Controls college recommendation scope: high_school keeps open recommendations; community_college and university restrict recommendations to the home institution.';
comment on column public.account_institutions.catalog_institution_id is
  'Optional link to the IPEDS/College Scorecard institution used for home-institution program recommendations.';
