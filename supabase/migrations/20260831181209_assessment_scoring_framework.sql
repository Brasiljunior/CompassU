create table public.career_clusters (
  code text primary key,
  name text not null unique,
  description text
);

create table public.major_cluster_weights (
  major_id integer not null references public.majors(id) on delete cascade,
  cluster_code text not null references public.career_clusters(code) on delete cascade,
  weight numeric not null check (weight >= 0 and weight <= 1),
  primary key (major_id, cluster_code)
);

alter table public.career_clusters enable row level security;
alter table public.major_cluster_weights enable row level security;

create policy "authenticated_read_clusters" on public.career_clusters for select to authenticated using (true);
create policy "authenticated_read_major_weights" on public.major_cluster_weights for select to authenticated using (true);

grant select on public.career_clusters, public.major_cluster_weights to authenticated;;


-- Explicit server access for replay without automatic Data API grants.
grant select, insert, update, delete on public.career_clusters, public.major_cluster_weights to service_role;
