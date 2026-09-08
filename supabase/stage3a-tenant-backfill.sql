-- CompassU Stage 3A: idempotent tenant backfill
-- Run only AFTER stage3a-tenant-foundation.sql.
-- Existing institution-name assignments remain authoritative during Stage 3A.
-- Each distinct existing institution is initially represented as an independent organization.
-- Future district/system grouping is an explicit administrative operation; this script does not infer relationships.

alter table public.account_institutions
  add column if not exists institution_id uuid references public.institutions(id) on delete restrict;

create index if not exists account_institutions_institution_id_idx
  on public.account_institutions(institution_id);

-- Create one independent organization for every legacy institution name that does not yet map
-- to an institution record. The hash suffix makes the generated slug deterministic and collision-safe.
with legacy as (
  select distinct trim(ai.institution) as institution_name,
    lower(trim(ai.institution)) as normalized_name
  from public.account_institutions ai
  where nullif(trim(ai.institution),'') is not null
), missing as (
  select l.*
  from legacy l
  where not exists (
    select 1 from public.institutions i where i.normalized_name=l.normalized_name
  )
)
insert into public.organizations(name,slug,organization_type)
select
  m.institution_name,
  'legacy-' || substr(md5(m.normalized_name),1,16),
  'independent'
from missing m
on conflict (slug) do nothing;

with legacy as (
  select distinct trim(ai.institution) as institution_name,
    lower(trim(ai.institution)) as normalized_name
  from public.account_institutions ai
  where nullif(trim(ai.institution),'') is not null
)
insert into public.institutions(organization_id,name)
select o.id,l.institution_name
from legacy l
join public.organizations o on o.slug='legacy-' || substr(md5(l.normalized_name),1,16)
where not exists (
  select 1 from public.institutions i where i.normalized_name=l.normalized_name
);

-- Link legacy assignments only when there is exactly one normalized institution match.
with unique_matches as (
  select normalized_name,min(id) as institution_id
  from public.institutions
  group by normalized_name
  having count(*)=1
)
update public.account_institutions ai
set institution_id=um.institution_id
from unique_matches um
where nullif(trim(ai.institution),'') is not null
  and lower(trim(ai.institution))=um.normalized_name
  and ai.institution_id is distinct from um.institution_id;

-- Validation view: expected result after a clean backfill is zero unlinked or mismatched rows.
create or replace view public.stage3a_tenant_backfill_validation as
select
  count(*) filter (where nullif(trim(ai.institution),'') is not null)::int as legacy_assignments,
  count(*) filter (where nullif(trim(ai.institution),'') is not null and ai.institution_id is not null)::int as linked_assignments,
  count(*) filter (where nullif(trim(ai.institution),'') is not null and ai.institution_id is null)::int as unlinked_assignments,
  count(*) filter (
    where ai.institution_id is not null
      and lower(trim(ai.institution)) is distinct from i.normalized_name
  )::int as mismatched_assignments,
  (select count(*)::int from public.organizations where active) as active_organizations,
  (select count(*)::int from public.institutions where active) as active_institutions
from public.account_institutions ai
left join public.institutions i on i.id=ai.institution_id;

revoke all on public.stage3a_tenant_backfill_validation from public,anon;
grant select on public.stage3a_tenant_backfill_validation to authenticated;

comment on column public.account_institutions.institution_id is
  'Stage 3 durable institution reference. Legacy institution text is preserved during migration.';
