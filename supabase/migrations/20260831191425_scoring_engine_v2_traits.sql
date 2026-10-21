create table if not exists public.scoring_traits (code text primary key, name text not null unique);
create table if not exists public.question_trait_weights (question_id integer not null references public.assessment_questions(id) on delete cascade, trait_code text not null references public.scoring_traits(code) on delete cascade, weight numeric not null default 1 check(weight>0), primary key(question_id,trait_code));
create table if not exists public.major_trait_weights (major_id integer not null references public.majors(id) on delete cascade, trait_code text not null references public.scoring_traits(code) on delete cascade, weight numeric not null check(weight>0), primary key(major_id,trait_code));
alter table public.scoring_traits enable row level security; alter table public.question_trait_weights enable row level security; alter table public.major_trait_weights enable row level security;
drop policy if exists scoring_traits_read on public.scoring_traits; create policy scoring_traits_read on public.scoring_traits for select to authenticated using(true);
drop policy if exists question_trait_weights_read on public.question_trait_weights; create policy question_trait_weights_read on public.question_trait_weights for select to authenticated using(true);
drop policy if exists major_trait_weights_read on public.major_trait_weights; create policy major_trait_weights_read on public.major_trait_weights for select to authenticated using(true);
grant select on public.scoring_traits,public.question_trait_weights,public.major_trait_weights to authenticated;
insert into public.scoring_traits(code,name) values
('quantitative','Quantitative & Analytical'),('computing','Computing & Digital Systems'),('engineering','Engineering & Systems Design'),('life_science','Life Sciences'),('physical_science','Physical Sciences & Research'),('healthcare','Clinical Health & Patient Care'),('helping','Helping & Counseling'),('teaching','Teaching & Learning'),('business_finance','Business & Finance'),('leadership_sales','Leadership, Persuasion & Sales'),('operations','Organization & Operations'),('creative_design','Creative & Visual Design'),('writing_media','Writing, Media & Communication'),('law_public','Law, Government & Public Service'),('social_behavioral','Social & Behavioral Analysis'),('hands_on','Hands-on Mechanical & Technical'),('environment_ag','Environment, Agriculture & Natural Resources'),('hospitality_service','Hospitality & Service') on conflict do nothing;
truncate public.question_trait_weights;
insert into public.question_trait_weights(question_id,trait_code,weight)
select id, case question_number
when 1 then 'quantitative' when 2 then 'engineering' when 3 then 'physical_science' when 4 then 'computing' when 5 then 'healthcare' when 6 then 'life_science' when 7 then 'teaching' when 8 then 'helping' when 9 then 'operations' when 10 then 'business_finance' when 11 then 'writing_media' when 12 then 'creative_design' when 13 then 'law_public' when 14 then 'social_behavioral' when 15 then 'hands_on' when 16 then 'hands_on' when 17 then 'environment_ag' when 18 then 'environment_ag' when 19 then 'quantitative' when 20 then 'leadership_sales'
when 21 then 'quantitative' when 22 then 'quantitative' when 23 then 'computing' when 24 then 'writing_media' when 25 then 'writing_media' when 26 then 'operations' when 27 then 'leadership_sales' when 28 then 'healthcare' when 29 then 'physical_science' when 30 then 'helping' when 31 then 'teaching' when 32 then 'hands_on' when 33 then 'creative_design' when 34 then 'leadership_sales' when 35 then 'social_behavioral'
when 36 then 'operations' when 37 then 'helping' when 38 then 'computing' when 39 then 'helping' when 40 then 'leadership_sales' when 41 then 'teaching' when 42 then 'healthcare' when 43 then 'leadership_sales' when 44 then 'quantitative' when 45 then 'creative_design' when 46 then 'operations' when 47 then 'healthcare' when 48 then 'hands_on' when 49 then 'social_behavioral' when 50 then 'law_public'
when 51 then 'business_finance' when 52 then 'operations' when 53 then 'helping' when 54 then 'creative_design' when 55 then 'leadership_sales' when 56 then 'law_public' when 57 then 'leadership_sales' when 58 then 'helping' when 59 then 'engineering' when 60 then 'environment_ag'
when 61 then 'healthcare' when 62 then 'physical_science' when 63 then 'business_finance' when 64 then 'teaching' when 65 then 'environment_ag' when 66 then 'hands_on' when 67 then 'computing' when 68 then 'law_public' when 69 then 'creative_design' when 70 then 'hospitality_service'
when 71 then 'quantitative' when 72 then 'physical_science' when 73 then 'computing' when 74 then 'writing_media' when 75 then 'social_behavioral' when 76 then 'business_finance' when 77 then 'life_science' when 78 then 'creative_design' when 79 then 'hands_on' when 80 then 'environment_ag' end,1 from public.assessment_questions;
truncate public.major_trait_weights;
-- defaults by CompassU cluster
insert into public.major_trait_weights(major_id,trait_code,weight)
select id, case career_cluster when 'IT' then 'computing' when 'STEM' then 'quantitative' when 'HEALTH' then 'healthcare' when 'BUSINESS' then 'business_finance' when 'EDU' then 'teaching' when 'ARTS' then 'creative_design' when 'PUBLIC' then 'law_public' when 'SOCIAL' then 'social_behavioral' when 'HUMAN' then 'helping' when 'TRADES' then 'hands_on' when 'ENV' then 'environment_ag' end,0.65 from public.majors where active=true;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id, case career_cluster when 'IT' then 'quantitative' when 'STEM' then 'physical_science' when 'HEALTH' then 'life_science' when 'BUSINESS' then 'operations' when 'EDU' then 'helping' when 'ARTS' then 'writing_media' when 'PUBLIC' then 'social_behavioral' when 'SOCIAL' then 'writing_media' when 'HUMAN' then 'social_behavioral' when 'TRADES' then 'engineering' when 'ENV' then 'life_science' end,0.35 from public.majors where active=true on conflict(major_id,trait_code) do update set weight=excluded.weight;
-- targeted CIP refinements
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'computing',0.75 from public.majors where active=true and cip_code like '11.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'quantitative',0.25 from public.majors where active=true and cip_code like '11.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'engineering',0.70 from public.majors where active=true and cip_code like '14.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'quantitative',0.20 from public.majors where active=true and cip_code like '14.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'physical_science',0.10 from public.majors where active=true and cip_code like '14.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'hands_on',0.50 from public.majors where active=true and cip_code like '15.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'engineering',0.35 from public.majors where active=true and cip_code like '15.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'computing',0.15 from public.majors where active=true and cip_code like '15.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'life_science',0.75 from public.majors where active=true and cip_code like '26.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'physical_science',0.15 from public.majors where active=true and cip_code like '26.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'quantitative',0.10 from public.majors where active=true and cip_code like '26.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'quantitative',0.80 from public.majors where active=true and cip_code like '27.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'computing',0.20 from public.majors where active=true and cip_code like '27.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'physical_science',0.75 from public.majors where active=true and cip_code like '40.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'quantitative',0.25 from public.majors where active=true and cip_code like '40.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'healthcare',0.70 from public.majors where active=true and cip_code like '51.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'life_science',0.20 from public.majors where active=true and cip_code like '51.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'helping',0.10 from public.majors where active=true and cip_code like '51.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'business_finance',0.55 from public.majors where active=true and cip_code like '52.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'operations',0.25 from public.majors where active=true and cip_code like '52.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'leadership_sales',0.20 from public.majors where active=true and cip_code like '52.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
-- special fields
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'creative_design',0.55 from public.majors where active=true and cip_code like '04.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'engineering',0.45 from public.majors where active=true and cip_code like '04.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'writing_media',0.75 from public.majors where active=true and cip_code like '09.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'creative_design',0.25 from public.majors where active=true and cip_code like '09.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'creative_design',0.70 from public.majors where active=true and cip_code like '50.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'writing_media',0.30 from public.majors where active=true and cip_code like '50.%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'hands_on',0.70 from public.majors where active=true and (cip_code like '46.%' or cip_code like '47.%' or cip_code like '48.%' or cip_code like '49.%') on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'engineering',0.30 from public.majors where active=true and (cip_code like '46.%' or cip_code like '47.%' or cip_code like '48.%' or cip_code like '49.%') on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'environment_ag',0.70 from public.majors where active=true and (cip_code like '01.%' or cip_code like '03.%') on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'life_science',0.30 from public.majors where active=true and (cip_code like '01.%' or cip_code like '03.%') on conflict(major_id,trait_code) do update set weight=excluded.weight;
-- named refinements
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'computing',0.55 from public.majors where active=true and cip_code='30.7001' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'quantitative',0.45 from public.majors where active=true and cip_code='30.7001' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'leadership_sales',0.35 from public.majors where active=true and lower(name) like '%marketing%' on conflict(major_id,trait_code) do update set weight=excluded.weight;
insert into public.major_trait_weights(major_id,trait_code,weight) select id,'creative_design',0.20 from public.majors where active=true and lower(name) like '%marketing%' on conflict(major_id,trait_code) do update set weight=excluded.weight;

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
 from majors m join major_trait_weights mtw on mtw.major_id=m.id left join trait_scores ts on ts.trait_code=mtw.trait_code
 where m.active=true group by m.id,m.name
), ranked as (select id,name,score,row_number() over(order by score desc,name)::int r from major_scores)
select id,name,score,r from ranked order by r;
$$;
revoke all on function public.score_assessment(uuid) from public,anon; grant execute on function public.score_assessment(uuid) to authenticated;
alter table public.assessment_attempts alter column scoring_version set default 'v2';
create index if not exists question_trait_weights_trait_idx on public.question_trait_weights(trait_code);
create index if not exists major_trait_weights_trait_idx on public.major_trait_weights(trait_code);;


-- Explicit server access for replay without automatic Data API grants.
grant select, insert, update, delete on public.scoring_traits, public.question_trait_weights, public.major_trait_weights to service_role;
