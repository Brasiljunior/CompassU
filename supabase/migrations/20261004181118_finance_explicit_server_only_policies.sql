do $$ declare t text; begin foreach t in array array['finance_settings','finance_customers','finance_invoices','finance_expenses','finance_payments','finance_deliveries','finance_audit'] loop execute format('create policy finance_server_only on public.%I for all to anon,authenticated using(false) with check(false)',t); end loop;end $$;
revoke all on sequence public.finance_invoice_number,public.finance_audit_id_seq from public,anon,authenticated;
create or replace function public.finance_generate_cycle(p_day date, p_automatic boolean default true, p_actor uuid default null)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer; begin
 insert into finance_invoices(customer_id,period,issue_date,due_date,status,snapshot,quantity,unit_cents,total_cents,auto_send)
 select c.id,date_trunc('month',p_day)::date,
 date_trunc('month',p_day)::date+c.billing_day-1,
 date_trunc('month',p_day)::date+c.billing_day-1+c.net_days,
 case when p_automatic then 'issued' else 'draft' end,
 jsonb_build_object('name',c.name,'email',c.email,'address',c.address,'reference',c.reference,'pricing',c.pricing,
 'company',s.company,'contact_email',s.contact_email,'payment_instructions',s.payment_instructions),
 case when c.pricing='fixed' then 1 else c.quantity end,c.unit_cents,
 c.unit_cents*(case when c.pricing='fixed' then 1 else c.quantity end),p_automatic
 from finance_customers c cross join finance_settings s
 where c.active and (not p_automatic or c.auto_send)
 and c.starts_on<=date_trunc('month',p_day)::date+c.billing_day-1
 and (not p_automatic or c.billing_day<=extract(day from p_day))
 on conflict(customer_id,period) do nothing;
 get diagnostics n=row_count;
 -- A reviewed draft is never silently issued by the scheduler.
 if n>0 then insert into finance_audit(actor,action,details) values(p_actor,case when p_automatic then 'scheduled_cycle' else 'generate_drafts' end,jsonb_build_object('period',date_trunc('month',p_day)::date,'count',n)); end if;
 return n;
end $$;

;

