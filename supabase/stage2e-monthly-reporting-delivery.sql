-- CompassU Stage 2E-B: monthly report delivery logging
-- Install after stage2e-monthly-reporting-foundation.sql

create or replace function public.record_monthly_report_delivery(
  p_reporting_profile_id uuid,
  p_institution text,
  p_reporting_period_start date,
  p_reporting_period_end date,
  p_recipient_emails text[],
  p_status text,
  p_provider_message_id text default null,
  p_error_message text default null
)
returns public.institution_report_delivery_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt integer;
  v_row public.institution_report_delivery_log;
begin
  if auth.uid() is null or not public.is_compassu_admin() then
    raise exception 'Master administrator access required';
  end if;
  if p_status not in ('scheduled','generating','sent','failed','skipped') then
    raise exception 'Invalid delivery status';
  end if;

  select coalesce(max(attempt_number),0)+1
    into v_attempt
  from public.institution_report_delivery_log
  where institution=p_institution
    and reporting_period_start=p_reporting_period_start;

  insert into public.institution_report_delivery_log(
    reporting_profile_id,institution,reporting_period_start,reporting_period_end,
    recipient_emails,status,attempt_number,provider_message_id,error_message,
    generated_at,sent_at
  ) values (
    p_reporting_profile_id,trim(p_institution),p_reporting_period_start,p_reporting_period_end,
    coalesce(p_recipient_emails,'{}'),p_status,v_attempt,p_provider_message_id,p_error_message,
    case when p_status in ('sent','failed') then now() else null end,
    case when p_status='sent' then now() else null end
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_monthly_report_delivery(uuid,text,date,date,text[],text,text,text) from public;
grant execute on function public.record_monthly_report_delivery(uuid,text,date,date,text[],text,text,text) to authenticated;

comment on function public.record_monthly_report_delivery(uuid,text,date,date,text[],text,text,text) is
  'Stage 2E Master Administrator RPC for recording monthly institutional report delivery attempts.';
