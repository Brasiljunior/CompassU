alter table public.occupations add column if not exists projection_start_year integer;
alter table public.occupations add column if not exists projection_end_year integer;
alter table public.occupations add column if not exists annual_openings numeric;
alter table public.occupations add column if not exists typical_education text;
alter table public.occupations add column if not exists work_experience text;
alter table public.occupations add column if not exists on_the_job_training text;
alter table public.occupations add column if not exists labor_data_updated_at timestamptz;;

