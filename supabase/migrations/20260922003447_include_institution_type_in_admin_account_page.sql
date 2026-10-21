
create or replace function public.admin_account_page_50k(
  p_page integer default 1,
  p_page_size integer default 50,
  p_search text default null,
  p_institution text default null
) returns jsonb
language sql
security definer
set search_path to 'public','auth','extensions','pg_temp'
as $function$
with params as (
 select greatest(coalesce(p_page,1),1) page,
        least(greatest(coalesce(p_page_size,50),1),100) page_size,
        nullif(trim(coalesce(p_search,'')),'') search,
        nullif(trim(coalesce(p_institution,'')),'') institution
), filtered as (
 select u.id,coalesce(u.email,'') email,
        coalesce(p.first_name,u.raw_user_meta_data->>'first_name','') first_name,
        coalesce(p.last_name,u.raw_user_meta_data->>'last_name','') last_name,
        coalesce(p.state,'') state,
        coalesce(ai.institution,'') institution,
        coalesce(ai.institution_type,'high_school') institution_type,
        u.created_at,u.last_sign_in_at,u.email_confirmed_at,u.banned_until,
        (u.banned_until is not null and u.banned_until>now()) is_suspended
 from auth.users u
 left join public.profiles p on p.id=u.id
 left join public.account_institutions ai on lower(ai.email)=lower(coalesce(u.email,''))
 cross join params x
 where (x.institution is null or lower(coalesce(ai.institution,''))=lower(x.institution))
   and (x.search is null
     or lower(coalesce(u.email,'')) like '%'||lower(x.search)||'%'
     or lower(coalesce(p.first_name,u.raw_user_meta_data->>'first_name','')) like '%'||lower(x.search)||'%'
     or lower(coalesce(p.last_name,u.raw_user_meta_data->>'last_name','')) like '%'||lower(x.search)||'%'
     or lower(coalesce(p.state,'')) like '%'||lower(x.search)||'%'
     or lower(coalesce(ai.institution,'')) like '%'||lower(x.search)||'%')
), counts as (select count(*)::bigint total from filtered), page_users as (
 select f.* from filtered f cross join params x
 order by f.created_at desc,f.id
 limit (select page_size from params)
 offset ((select page from params)-1)*(select page_size from params)
), attempt_rollup as (
 select a.user_id,count(*)::bigint assessment_count,
        count(*) filter(where a.status='completed')::bigint completed_surveys,
        count(*) filter(where a.status='in_progress')::bigint in_progress_surveys,
        max(a.completed_at) filter(where a.completed_at is not null) last_completed_at
 from public.assessment_attempts a join page_users pu on pu.id=a.user_id
 group by a.user_id
), rows as (
 select jsonb_agg(jsonb_build_object(
   'id',pu.id,'email',pu.email,'first_name',pu.first_name,'last_name',pu.last_name,
   'state',pu.state,'institution',pu.institution,'institution_type',pu.institution_type,
   'created_at',pu.created_at,'last_sign_in_at',pu.last_sign_in_at,
   'email_confirmed_at',pu.email_confirmed_at,'assessment_count',coalesce(ar.assessment_count,0),
   'completed_surveys',coalesce(ar.completed_surveys,0),'in_progress_surveys',coalesce(ar.in_progress_surveys,0),
   'last_completed_at',ar.last_completed_at,'is_suspended',pu.is_suspended,'banned_until',pu.banned_until
 ) order by pu.created_at desc,pu.id) users
 from page_users pu left join attempt_rollup ar on ar.user_id=pu.id
)
select jsonb_build_object('users',coalesce(r.users,'[]'::jsonb),'pagination',
 jsonb_build_object('page',p.page,'page_size',p.page_size,'total',c.total,
 'total_pages',greatest(1,ceil(c.total::numeric/p.page_size::numeric)::integer),
 'has_previous',p.page>1,'has_next',p.page<greatest(1,ceil(c.total::numeric/p.page_size::numeric)::integer)))
from params p cross join counts c cross join rows r;
$function$;
;

