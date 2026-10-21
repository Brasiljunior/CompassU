create or replace function public.score_assessment(p_attempt_id uuid)
returns table(major_id integer, major_name text, match_score numeric, rank integer)
language sql
security invoker
set search_path = public
as $$
with owned_attempt as (
  select id, user_id
  from public.assessment_attempts
  where id = p_attempt_id and user_id = (select auth.uid())
),
response_scores as (
  select
    (q.scoring_key->>'cluster') as cluster_code,
    avg(((r.response_value->>'value')::numeric - 1) / 4.0 * 100.0) as cluster_score
  from public.assessment_responses r
  join owned_attempt a on a.id = r.attempt_id
  join public.assessment_questions q on q.id = r.question_id
  where r.user_id = (select auth.uid())
    and r.response_value ? 'value'
    and (r.response_value->>'value') ~ '^[1-5]$'
  group by (q.scoring_key->>'cluster')
),
major_scores as (
  select
    m.id as major_id,
    m.name as major_name,
    round((sum(coalesce(rs.cluster_score,0) * mcw.weight) / nullif(sum(mcw.weight),0))::numeric,1) as match_score
  from public.majors m
  join public.major_cluster_weights mcw on mcw.major_id = m.id
  left join response_scores rs on rs.cluster_code = mcw.cluster_code
  where m.active = true
  group by m.id,m.name
),
ranked as (
  select major_id, major_name, match_score,
         row_number() over(order by match_score desc, major_name asc)::integer as rank
  from major_scores
)
select major_id, major_name, match_score, rank
from ranked
order by rank;
$$;

grant execute on function public.score_assessment(uuid) to authenticated;;

