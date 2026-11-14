-- REVIEW-ONLY DRAFT. DO NOT APPLY TO PRODUCTION OR STAGING UNTIL REGRESSION TESTED.
-- Atomic trusted finalization: retains the existing RPC signature and return shape.
-- Must deploy together with client write privilege restrictions, never separately.
create or replace function public.finalize_assessment(p_attempt_id uuid)
returns table(major_id integer, major_name text, match_score numeric, rank integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.assessment_attempts%rowtype;
  v_assignment public.institution_student_assignments%rowtype;
  v_completed_at timestamptz;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_attempt from public.assessment_attempts a
  where a.id = p_attempt_id and a.user_id = v_user for update;
  if not found then raise exception 'Assessment attempt not found'; end if;
  if v_attempt.status not in ('in_progress','completed') then
    raise exception 'Invalid assessment status';
  end if;
  if (select count(*) from public.assessment_responses r
      where r.attempt_id=p_attempt_id and r.user_id=v_user) < 80 then
    raise exception 'All 80 questions must be answered before finalizing';
  end if;

  -- Repeated results-loading calls must not create a new completion event.
  if v_attempt.status = 'in_progress' then
    if v_attempt.completed_at is not null then
      raise exception 'Invalid assessment completion state';
    end if;
    delete from public.major_matches mm
      where mm.attempt_id=p_attempt_id and mm.user_id=v_user;
    insert into public.major_matches(attempt_id,user_id,major_id,match_score,rank,explanation)
    select p_attempt_id,v_user,s.major_id,s.match_score,s.rank,null
    from public.score_assessment(p_attempt_id) s where s.rank<=10;
    v_completed_at := now();
    update public.assessment_attempts
    set status='completed', completed_at=v_completed_at, scoring_version='v2'
    where id=p_attempt_id and user_id=v_user;

    -- Only independently verified student assignments can become immutable
    -- completion-time snapshots. No tenant ID is supplied by the browser.
    select * into v_assignment from public.institution_student_assignments a
      where a.user_id=v_user
        and a.verified_at is not null
        and a.verified_at <= a.assigned_at
        and a.verified_at <= v_completed_at
        and nullif(btrim(a.evidence_reference),'') is not null;
    if found then
      insert into public.institution_assessment_affiliations
        (attempt_id,tenant_institution_id,evidence_reference,recorded_at,recorded_by)
      values (p_attempt_id,v_assignment.tenant_institution_id,
              v_assignment.evidence_reference,v_completed_at,v_user);
    end if;
  elsif v_attempt.completed_at is null then
    raise exception 'Invalid assessment completion state';
  elsif not exists (
    select 1 from public.major_matches mm
    where mm.attempt_id=p_attempt_id and mm.user_id=v_user
  ) then
    -- Preserve existing loadResults fallback for completed attempts with
    -- missing matches; this is NOT a new completion or affiliation snapshot.
    insert into public.major_matches(attempt_id,user_id,major_id,match_score,rank,explanation)
    select p_attempt_id,v_user,s.major_id,s.match_score,s.rank,null
    from public.score_assessment(p_attempt_id) s where s.rank<=10;
  end if;

  return query select mm.major_id,m.name,mm.match_score,mm.rank
  from public.major_matches mm join public.majors m on m.id=mm.major_id
  where mm.attempt_id=p_attempt_id and mm.user_id=v_user
  order by mm.rank;
end;
$$;

-- Client should only be able to INSERT user_id; all other fields use DB defaults.
-- RLS INSERT policy must independently require auth.uid() = user_id.
revoke insert, update on public.assessment_attempts from authenticated;
grant insert (user_id) on public.assessment_attempts to authenticated;
-- No direct client UPDATE granted: completion is RPC-only.
revoke all on function public.finalize_assessment(uuid) from public, anon;
grant execute on function public.finalize_assessment(uuid) to authenticated;

-- Preflight still required: function owner, response/score access,
-- existing triggers, RLS insert policy, service-role clients, and
-- whether any other UI path needs direct attempt updates.
