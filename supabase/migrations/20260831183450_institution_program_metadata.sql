alter table public.institutions
  add column if not exists opeid text,
  add column if not exists sector integer,
  add column if not exists highest_award_level integer,
  add column if not exists source_year integer;

alter table public.institution_majors
  add column if not exists cip_code text,
  add column if not exists completions_total integer,
  add column if not exists award_levels jsonb not null default '[]'::jsonb,
  add column if not exists source_year integer,
  add column if not exists evidence_type text not null default 'IPEDS completions';

create index if not exists institutions_state_idx on public.institutions(state);
create index if not exists institution_majors_major_idx on public.institution_majors(major_id);
create index if not exists institution_majors_cip_idx on public.institution_majors(cip_code);
;

