begin;
CREATE OR REPLACE FUNCTION public.get_monthly_reporting_profiles()
 RETURNS SETOF institution_reporting_profiles LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
 select p.* from public.institution_reporting_profiles p where auth.uid() is not null and public.is_compassu_admin() order by p.institution;
$function$;
CREATE OR REPLACE FUNCTION public.get_monthly_reporting_profiles_for_service()
 RETURNS SETOF institution_reporting_profiles LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required'; end if;
 return query select p.* from public.institution_reporting_profiles p where p.active=true order by p.institution;
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_monthly_report_delivery_log(p_limit integer DEFAULT 100)
 RETURNS SETOF institution_report_delivery_log LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
 select l.* from public.institution_report_delivery_log l where auth.uid() is not null and public.is_compassu_admin() order by l.created_at desc limit greatest(1,least(coalesce(p_limit,100),500));
$function$;
CREATE OR REPLACE FUNCTION public.has_successful_monthly_report_delivery_service(p_reporting_profile_id uuid,p_reporting_period_start date)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required'; end if;
 return exists(select 1 from public.institution_report_delivery_log l where l.reporting_profile_id=p_reporting_profile_id and l.reporting_period_start=p_reporting_period_start and l.status='sent');
end;
$function$;
CREATE OR REPLACE FUNCTION public.record_monthly_report_delivery_service(p_reporting_profile_id uuid,p_institution text,p_reporting_period_start date,p_reporting_period_end date,p_recipient_emails text[],p_status text,p_provider_message_id text DEFAULT NULL::text,p_error_message text DEFAULT NULL::text)
 RETURNS institution_report_delivery_log LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $function$
declare v_attempt integer; v_row public.institution_report_delivery_log;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required'; end if;
 if p_status not in ('scheduled','generating','sent','failed','skipped') then raise exception 'Invalid delivery status'; end if;
 perform pg_advisory_xact_lock(hashtext(trim(p_institution)||'|'||p_reporting_period_start::text));
 select coalesce(max(attempt_number),0)+1 into v_attempt from public.institution_report_delivery_log where institution=trim(p_institution) and reporting_period_start=p_reporting_period_start;
 insert into public.institution_report_delivery_log(reporting_profile_id,institution,reporting_period_start,reporting_period_end,recipient_emails,status,attempt_number,provider_message_id,error_message,generated_at,sent_at)
 values(p_reporting_profile_id,trim(p_institution),p_reporting_period_start,p_reporting_period_end,coalesce(p_recipient_emails,'{}'),p_status,v_attempt,p_provider_message_id,p_error_message,case when p_status in ('sent','failed') then now() else null end,case when p_status='sent' then now() else null end)
 returning * into v_row;
 return v_row;
end;
$function$;
CREATE OR REPLACE FUNCTION public.record_monthly_report_delivery(p_reporting_profile_id uuid,p_institution text,p_reporting_period_start date,p_reporting_period_end date,p_recipient_emails text[],p_status text,p_provider_message_id text DEFAULT NULL::text,p_error_message text DEFAULT NULL::text)
 RETURNS institution_report_delivery_log LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_attempt integer; v_row public.institution_report_delivery_log;
begin
 if auth.uid() is null or not public.is_compassu_admin() then raise exception 'Master administrator access required'; end if;
 if p_status not in ('scheduled','generating','sent','failed','skipped') then raise exception 'Invalid delivery status'; end if;
 select coalesce(max(attempt_number),0)+1 into v_attempt from public.institution_report_delivery_log where institution=p_institution and reporting_period_start=p_reporting_period_start;
 insert into public.institution_report_delivery_log(reporting_profile_id,institution,reporting_period_start,reporting_period_end,recipient_emails,status,attempt_number,provider_message_id,error_message,generated_at,sent_at)
 values(p_reporting_profile_id,trim(p_institution),p_reporting_period_start,p_reporting_period_end,coalesce(p_recipient_emails,'{}'),p_status,v_attempt,p_provider_message_id,p_error_message,case when p_status in ('sent','failed') then now() else null end,case when p_status='sent' then now() else null end)
 returning * into v_row;
 return v_row;
end;
$function$;
CREATE OR REPLACE FUNCTION public.set_institution_monthly_reporting_profile(p_institution text,p_recipient_emails text[],p_active boolean DEFAULT true,p_delivery_day integer DEFAULT 5,p_timezone text DEFAULT 'America/Chicago'::text,p_include_institutional_analytics boolean DEFAULT true,p_include_institutional_trends boolean DEFAULT true,p_include_executive_insights boolean DEFAULT true)
 RETURNS institution_reporting_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_profile public.institution_reporting_profiles; v_emails text[];
begin
 if auth.uid() is null or not public.is_compassu_admin() then raise exception 'Master administrator access required'; end if;
 if nullif(trim(p_institution),'') is null then raise exception 'Institution is required'; end if;
 if p_delivery_day<1 or p_delivery_day>28 then raise exception 'Delivery day must be between 1 and 28'; end if;
 select coalesce(array_agg(distinct lower(trim(email))) filter(where trim(email)<>''),'{}') into v_emails from unnest(coalesce(p_recipient_emails,'{}')) email;
 if coalesce(p_active,true) and cardinality(v_emails)=0 then raise exception 'At least one report recipient email is required for an active profile'; end if;
 insert into public.institution_reporting_profiles(institution,recipient_emails,active,delivery_day,timezone,include_institutional_analytics,include_institutional_trends,include_executive_insights,updated_at)
 values(trim(p_institution),v_emails,coalesce(p_active,true),p_delivery_day,coalesce(nullif(trim(p_timezone),''),'America/Chicago'),coalesce(p_include_institutional_analytics,true),coalesce(p_include_institutional_trends,true),coalesce(p_include_executive_insights,true),now())
 on conflict(institution) do update set recipient_emails=excluded.recipient_emails,active=excluded.active,delivery_day=excluded.delivery_day,timezone=excluded.timezone,include_institutional_analytics=excluded.include_institutional_analytics,include_institutional_trends=excluded.include_institutional_trends,include_executive_insights=excluded.include_executive_insights,updated_at=now()
 returning * into v_profile;
 return v_profile;
end;
$function$;
REVOKE ALL ON FUNCTION public.get_monthly_reporting_profiles(),public.get_monthly_report_delivery_log(integer),public.record_monthly_report_delivery(uuid,text,date,date,text[],text,text,text),public.set_institution_monthly_reporting_profile(text,text[],boolean,integer,text,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_reporting_profiles(),public.get_monthly_report_delivery_log(integer),public.record_monthly_report_delivery(uuid,text,date,date,text[],text,text,text),public.set_institution_monthly_reporting_profile(text,text[],boolean,integer,text,boolean,boolean,boolean) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_monthly_reporting_profiles_for_service(),public.has_successful_monthly_report_delivery_service(uuid,date),public.record_monthly_report_delivery_service(uuid,text,date,date,text[],text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_reporting_profiles_for_service(),public.has_successful_monthly_report_delivery_service(uuid,date),public.record_monthly_report_delivery_service(uuid,text,date,date,text[],text,text,text) TO service_role;
commit;;

