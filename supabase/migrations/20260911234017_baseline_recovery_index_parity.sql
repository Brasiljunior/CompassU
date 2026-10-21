create extension if not exists pg_trgm;
create index if not exists account_institutions_name_trgm_50k_idx on public.account_institutions using gin (lower(coalesce(institution,''::text)) gin_trgm_ops);
create index if not exists assessment_attempts_completed_at_idx on public.assessment_attempts using btree (completed_at) where completed_at is not null;
create index if not exists assessment_attempts_started_at_idx on public.assessment_attempts using btree (started_at) where started_at is not null;
create index if not exists assessment_attempts_user_status_idx on public.assessment_attempts using btree (user_id,status);
create index if not exists profiles_first_name_trgm_50k_idx on public.profiles using gin (lower(coalesce(first_name,''::text)) gin_trgm_ops);
create index if not exists profiles_last_name_trgm_50k_idx on public.profiles using gin (lower(coalesce(last_name,''::text)) gin_trgm_ops);
create index if not exists profiles_name_idx on public.profiles using btree (lower(coalesce(first_name,''::text)),lower(coalesce(last_name,''::text)));
create index if not exists profiles_state_trgm_50k_idx on public.profiles using gin (lower(coalesce(state,''::text)) gin_trgm_ops);;

