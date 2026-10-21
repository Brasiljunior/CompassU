create table if not exists public.user_major_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  major_id integer not null references public.majors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, major_id)
);

alter table public.user_major_favorites enable row level security;

drop policy if exists "Users can read own major favorites" on public.user_major_favorites;
create policy "Users can read own major favorites"
on public.user_major_favorites for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own major favorites" on public.user_major_favorites;
create policy "Users can add own major favorites"
on public.user_major_favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own major favorites" on public.user_major_favorites;
create policy "Users can delete own major favorites"
on public.user_major_favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.user_major_favorites from anon;
grant select, insert, delete on public.user_major_favorites to authenticated;
create index if not exists user_major_favorites_major_idx on public.user_major_favorites(major_id);

create or replace function public.finalize_assessment(p_attempt_id uuid)
returns table (major_id integer, major_name text, match_score numeric, rank integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.assessment_attempts a
    where a.id = p_attempt_id and a.user_id = v_user
  ) then
    raise exception 'Assessment attempt not found';
  end if;

  if (select count(*) from public.assessment_responses r where r.attempt_id = p_attempt_id and r.user_id = v_user) < 80 then
    raise exception 'All 80 questions must be answered before finalizing';
  end if;

  delete from public.major_matches mm where mm.attempt_id = p_attempt_id and mm.user_id = v_user;

  insert into public.major_matches (attempt_id, user_id, major_id, match_score, rank, explanation)
  select p_attempt_id, v_user, s.major_id, s.match_score, s.rank,
         'Match based on your CompassU interests, strengths, personality, values, work preferences, and academic preferences.'
  from public.score_assessment(p_attempt_id) s
  where s.rank <= 10;

  update public.assessment_attempts
  set status='completed', completed_at=coalesce(completed_at, now()), scoring_version='v2'
  where id=p_attempt_id and user_id=v_user;

  return query
  select mm.major_id, m.name, mm.match_score, mm.rank
  from public.major_matches mm
  join public.majors m on m.id=mm.major_id
  where mm.attempt_id=p_attempt_id and mm.user_id=v_user
  order by mm.rank;
end;
$$;

revoke all on function public.finalize_assessment(uuid) from public, anon;
grant execute on function public.finalize_assessment(uuid) to authenticated;

create or replace function public.get_major_explanation(p_attempt_id uuid, p_major_id integer)
returns table (trait_code text, trait_name text, user_score numeric, major_weight numeric, contribution numeric)
language sql
security invoker
set search_path = public
as $$
  with owned as (
    select 1 from public.assessment_attempts a
    where a.id=p_attempt_id and a.user_id=(select auth.uid())
  ), response_scores as (
    select qtw.trait_code,
           sum((((r.response_value->>'value')::numeric - 1) / 4.0) * 100 * qtw.weight) / nullif(sum(qtw.weight),0) as user_score
    from public.assessment_responses r
    join public.question_trait_weights qtw on qtw.question_id=r.question_id
    where r.attempt_id=p_attempt_id and r.user_id=(select auth.uid())
      and exists (select 1 from owned)
    group by qtw.trait_code
  )
  select mtw.trait_code,
         st.name as trait_name,
         round(coalesce(rs.user_score,50),1) as user_score,
         round(mtw.weight,3) as major_weight,
         round(coalesce(rs.user_score,50) * mtw.weight,1) as contribution
  from public.major_trait_weights mtw
  join public.scoring_traits st on st.code=mtw.trait_code
  left join response_scores rs on rs.trait_code=mtw.trait_code
  where mtw.major_id=p_major_id and exists (select 1 from owned)
  order by contribution desc, mtw.weight desc, st.name;
$$;

revoke all on function public.get_major_explanation(uuid, integer) from public, anon;
grant execute on function public.get_major_explanation(uuid, integer) to authenticated;;


-- Explicit server access for replay without automatic Data API grants.
grant select, insert, update, delete on public.user_major_favorites to service_role;
