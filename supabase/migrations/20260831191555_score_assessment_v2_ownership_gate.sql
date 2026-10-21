create or replace function public.score_assessment(p_attempt_id uuid)
returns table(major_id integer,major_name text,match_score numeric,rank integer)
language sql security invoker set search_path=public as $$
with owned as (select id from assessment_attempts where id=p_attempt_id and user_id=auth.uid()),
responses as (
 select qtw.trait_code, qtw.weight as qweight, (((ar.response_value->>'value')::numeric-1)/4.0)*100 as score
 from owned o join assessment_responses ar on ar.attempt_id=o.id join question_trait_weights qtw on qtw.question_id=ar.question_id
), trait_scores as (select trait_code, sum(score*qweight)/nullif(sum(qweight),0) trait_score from responses group by trait_code),
major_scores as (
 select m.id,m.name, round((sum(coalesce(ts.trait_score,50)*mtw.weight)/nullif(sum(mtw.weight),0))::numeric,1) score
 from owned o cross join majors m join major_trait_weights mtw on mtw.major_id=m.id left join trait_scores ts on ts.trait_code=mtw.trait_code
 where m.active=true group by m.id,m.name
), ranked as (select id,name,score,row_number() over(order by score desc,name)::int r from major_scores)
select id,name,score,r from ranked order by r;
$$;
revoke all on function public.score_assessment(uuid) from public,anon; grant execute on function public.score_assessment(uuid) to authenticated;;

