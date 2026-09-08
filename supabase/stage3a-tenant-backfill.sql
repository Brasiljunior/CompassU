-- CompassU Stage 3A: idempotent tenant backfill
-- Run only AFTER stage3a-tenant-foundation.sql.
-- Existing institution-name assignments remain authoritative during Stage 3A.
-- Each distinct existing institution is initially represented as an independent organization.
-- Future district/system grouping is an explicit administrative operation; this script does not infer relationships.

alter table public.account_institutions
  add column if not exists tenant_institution_id uuid references public.tenant_institutions(id) on delete restrict;

create index if not exists account_institutions_tenant_institution_id_idx
  on public.account_institutions(tenant_institution_id);

-- Create one independent organization for each distinct legacy institution name that does not yet map.
with legacy as (
  select distinct trim(ai.institution) as institution_name,
    lower(trim(ai.institution)) as normalized_name
  from public.account_institutions ai
  where nullif(trim(ai.institution),'') is not null
), missing as (
  select l.*
  from legacy l
  where not exists (
    select 1 from public.tenant_institutions ti where ti.normalized_name=l.normalized_name
  )
)
insert into public.organizations(name,slug,organization_type)
select
  m.institution_name,
  'legacy-' || substr(md5(m.normalized_name),1,16),
  'independent'
from missing m
on conflict (slug) do nothing;

-- Link to the existing bigint institution catalog only when the normalized name has exactly one match.
-- Ambiguous or absent catalog matches remain NULL rather than guessing.
with legacy as (
  select distinct trim(ai.institution) as institution_name,
    lower(trim(ai.institution)) as normalized_name
  from public.account_institutions ai
  where nullif(trim(ai.institution),'') is not null
), catalog_unique as (
  select lower(trim(i.name)) as normalized_name, min(i.id) as catalog_institution_id
  from public.institutions i
  where nullif(trim(i.name),'') is not null
  group by lower(trim(i.name))
  having count(*)=1
)
insert into public.tenant_institutions(organization_id,name,catalog_institution_id)
select
  o.id,
  l.institution_name,
  cu.catalog_institution_id
from legacy l
join public.organizations o on o.slug='legacy-' || substr(md5(l.normalized_name),1,16)
left join catalog_unique cu on cu.normalized_name=l.normalized_name
where not exists (
  select 1 from public.tenant_institutions ti where ti.normalized_name=l.normalized_name
);

-- Link legacy assignments only when there is exactly one normalized tenant-institution match.
with unique_matches as (
  select normalized_name,min(id) as tenant_institution_id
  from public.tenant_institutions
  group by normalized_name
  having count(*)=1
)
update public.account_institutions ai
set tenant_institution_id=um.tenant_institution_id
from unique_matches um
where nullif(trim(ai.institution),'') is not null
  and lower(trim(ai.institution))=um.normalized_name
  and ai.tenant_institution_id is distinct from um.tenant_institution_id;

-- Master-admin-only validation function.
create or replace function public.stage3a_tenant_backfill_validation()
returns table (
  legacy_assignments integer,
  linked_assignments integer,
  unlinked_assignments integer,
  mismatched_assignments integer,
  active_organizations integer,
  active_tenant_institutions integer
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    count(*) filter (where nullif(trim(ai.institution),'') is not null)::int,
    count(*) filter (where nullif(trim(ai.institution),'') is not null and ai.tenant_institution_id is not null)::int,
    count(*) filter (where nullif(trim(ai.institution),'') is not null and ai.tenant_institution_id is null)::int,
    count(*) filter (
      where ai.tenant_institution_id is not null
        and lower(trim(ai.institution)) is distinct from ti.normalized_name
    )::int,
    (select count(*)::int from public.organizations where active),
    (select count(*)::int from public.tenant_institutions where active)
  from public.account_institutions ai
  left join public.tenant_institutions ti on ti.id=ai.tenant_institution_id
  where public.is_compassu_master_admin();
$$;

revoke all on function public.stage3a_tenant_backfill_validation() from public;
grant execute on function public.stage3a_tenant_backfill_validation() to authenticated;

comment on column public.account_institutions.tenant_institution_id is
  'Stage 3 durable tenant-institution reference. Legacy institution text is preserved during migration.';
