-- CompassU Stage 3A validation checks
-- Read-only checks to run after foundation + backfill.

select * from public.stage3a_tenant_backfill_validation();

-- Expect zero rows: legacy assignments that did not receive a durable tenant institution id.
select ai.email,ai.institution
from public.account_institutions ai
where nullif(trim(ai.institution),'') is not null
  and ai.tenant_institution_id is null
order by ai.institution,ai.email;

-- Expect zero rows: durable tenant link disagrees with preserved legacy institution text.
select ai.email,ai.institution,ti.name as linked_institution
from public.account_institutions ai
join public.tenant_institutions ti on ti.id=ai.tenant_institution_id
where lower(trim(ai.institution)) is distinct from ti.normalized_name
order by ai.institution,ai.email;

-- Review generated tenant hierarchy. Stage 3A intentionally creates independent organizations
-- rather than guessing district/system relationships.
select o.id organization_id,o.name organization_name,o.organization_type,
       ti.id tenant_institution_id,ti.name institution_name,
       ti.catalog_institution_id,
       count(ai.email)::int assigned_accounts
from public.organizations o
join public.tenant_institutions ti on ti.organization_id=o.id
left join public.account_institutions ai on ai.tenant_institution_id=ti.id
where o.active and ti.active
group by o.id,o.name,o.organization_type,ti.id,ti.name,ti.catalog_institution_id
order by o.name,ti.name;

-- Existing master admins must remain present; Stage 3A does not rewrite admin_users.
select au.user_id,au.role,au.created_at
from public.admin_users au
order by au.created_at;
