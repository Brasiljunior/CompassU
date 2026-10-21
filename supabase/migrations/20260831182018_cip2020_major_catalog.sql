alter table public.majors add column if not exists cip_title text;
alter table public.majors add column if not exists cip_version integer not null default 2020;
alter table public.majors add column if not exists credential_scope text not null default 'postsecondary';
create unique index if not exists majors_cip_code_unique on public.majors(cip_code) where cip_code is not null;

create table if not exists public.cip_catalog (
 cip_code text primary key,
 cip_title text not null,
 cip_version integer not null default 2020,
 career_cluster text not null,
 compassu_display_name text not null,
 active boolean not null default true
);
alter table public.cip_catalog enable row level security;
create policy "authenticated_read_cip_catalog" on public.cip_catalog for select to authenticated using (active = true);
revoke all on public.cip_catalog from anon;
grant select on public.cip_catalog to authenticated;
;


-- Explicit server access for replay without automatic Data API grants.
grant select, insert, update, delete on public.cip_catalog to service_role;
