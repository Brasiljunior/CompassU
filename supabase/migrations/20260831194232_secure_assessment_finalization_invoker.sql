drop policy if exists "Users can insert own major matches" on public.major_matches;
create policy "Users can insert own major matches"
on public.major_matches for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_id and a.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete own major matches" on public.major_matches;
create policy "Users can delete own major matches"
on public.major_matches for delete
to authenticated
using ((select auth.uid()) = user_id);

grant insert, delete on public.major_matches to authenticated;

create or replace function public.enforce_major_match_integrity()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_score numeric;
  v_rank integer;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Invalid major match owner';
  end if;

  select s.match_score, s.rank into v_score, v_rank
  from public.score_assessment(new.attempt_id) s
  where s.major_id = new.major_id and s.rank <= 10;

  if v_score is null then
    raise exception 'Major is not a top-10 match for this assessment';
  end if;

  new.match_score := v_score;
  new.rank := v_rank;
  new.explanation := 'Match based on your CompassU interests, strengths, personality, values, work preferences, and academic preferences.';
  return new;
end;
$$;

drop trigger if exists major_match_integrity_before_insert on public.major_matches;
create trigger major_match_integrity_before_insert
before insert on public.major_matches
for each row execute function public.enforce_major_match_integrity();

create or replace function public.finalize_assessment(p_attempt_id uuid)
returns table (major_id integer, major_name text, match_score numeric, rank integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.assessment_attempts a where a.id=p_attempt_id and a.user_id=v_user) then
    raise exception 'Assessment attempt not found';
  end if;
  if (select count(*) from public.assessment_responses r where r.attempt_id=p_attempt_id and r.user_id=v_user) < 80 then
    raise exception 'All 80 questions must be answered before finalizing';
  end if;

  delete from public.major_matches mm where mm.attempt_id=p_attempt_id and mm.user_id=v_user;

  insert into public.major_matches(attempt_id,user_id,major_id,match_score,rank,explanation)
  select p_attempt_id,v_user,s.major_id,s.match_score,s.rank,null
  from public.score_assessment(p_attempt_id) s
  where s.rank<=10;

  update public.assessment_attempts
  set status='completed', completed_at=coalesce(completed_at,now()), scoring_version='v2'
  where id=p_attempt_id and user_id=v_user;

  return query
  select mm.major_id,m.name,mm.match_score,mm.rank
  from public.major_matches mm join public.majors m on m.id=mm.major_id
  where mm.attempt_id=p_attempt_id and mm.user_id=v_user
  order by mm.rank;
end;
$$;

revoke all on function public.finalize_assessment(uuid) from public,anon;
grant execute on function public.finalize_assessment(uuid) to authenticated;;

