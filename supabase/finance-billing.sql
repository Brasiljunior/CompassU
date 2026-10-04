-- CompassU finance is server-only: master administrators with verified MFA access it through the API.
create sequence if not exists public.finance_invoice_number;
create table public.finance_settings (
 id boolean primary key default true check(id), company text not null default 'CompassU',
 contact_email text not null default 'billing@getcompassu.com', payment_instructions text not null default '',
 updated_at timestamptz not null default now()
);
insert into public.finance_settings(id) values(true);
create table public.finance_customers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160),
 email text not null, address text not null default '', reference text not null default '',
 pricing text not null check(pricing in ('fixed','per_student')), unit_cents bigint not null check(unit_cents between 1 and 100000000),
 quantity integer not null default 1 check(quantity between 1 and 100000),
 starts_on date not null, billing_day integer not null default 1 check(billing_day between 1 and 28),
 net_days integer not null default 30 check(net_days between 0 and 90), active boolean not null default true,
 auto_send boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.finance_invoices (
 id uuid primary key default gen_random_uuid(), number text not null unique default ('CU-'||lpad(nextval('public.finance_invoice_number')::text,7,'0')),
 customer_id uuid not null references public.finance_customers(id), period date not null check(extract(day from period)=1),
 issue_date date not null, due_date date not null, status text not null default 'draft' check(status in ('draft','issued','void')),
 snapshot jsonb not null, quantity integer not null, unit_cents bigint not null, total_cents bigint not null check(total_cents>0),
 paid_cents bigint not null default 0 check(paid_cents>=0 and paid_cents<=total_cents), auto_send boolean not null default false,
 created_at timestamptz not null default now(), unique(customer_id,period)
);
create table public.finance_expenses (
 id uuid primary key default gen_random_uuid(), vendor text not null, description text not null, category text not null default 'Operations',
 total_cents bigint not null check(total_cents between 1 and 10000000000000), paid_cents bigint not null default 0 check(paid_cents>=0 and paid_cents<=total_cents),
 due_date date not null, status text not null default 'open' check(status in ('open','void')), created_at timestamptz not null default now()
);
create table public.finance_payments (
 id uuid primary key default gen_random_uuid(), invoice_id uuid references public.finance_invoices(id), expense_id uuid references public.finance_expenses(id),
 amount_cents bigint not null check(amount_cents>0), paid_on date not null, reference text not null default '', note text not null default '',
 request_id uuid not null unique, created_by uuid references auth.users(id), created_at timestamptz not null default now(), check((invoice_id is null) <> (expense_id is null))
);
create index finance_payments_invoice on public.finance_payments(invoice_id);
create index finance_payments_expense on public.finance_payments(expense_id);
create index finance_invoices_due on public.finance_invoices(due_date) where status='issued';
create table public.finance_deliveries (
 invoice_id uuid primary key references public.finance_invoices(id), payload jsonb not null,
 status text not null default 'queued' check(status in ('queued','sending','sent','failed','needs_review')),
 attempts integer not null default 0, first_attempt_at timestamptz, claimed_at timestamptz,
 sent_at timestamptz, provider_id text, error text, updated_at timestamptz not null default now()
);
create table public.finance_audit (
 id bigint generated always as identity primary key, actor uuid references auth.users(id), action text not null,
 record_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index finance_audit_actor on public.finance_audit(actor);
do $$ declare t text; begin
 foreach t in array array['finance_settings','finance_customers','finance_invoices','finance_expenses','finance_payments','finance_deliveries','finance_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy finance_server_only on public.%I for all to anon,authenticated using(false) with check(false)',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on sequence public.finance_invoice_number,public.finance_audit_id_seq from public,anon,authenticated;
grant usage,select on sequence public.finance_invoice_number,public.finance_audit_id_seq to service_role;

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

create or replace function public.finance_mutate(p_action text,p_data jsonb,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id uuid; r finance_invoices; e finance_expenses; result jsonb; amount bigint; begin
 if p_actor is null or not exists(select 1 from admin_users where user_id=p_actor and role='master_admin') then raise exception 'Master administrator required'; end if;
 v_id:=nullif(p_data->>'id','')::uuid;
 if p_action='customer' then
 if v_id is null then
 insert into finance_customers(name,email,address,reference,pricing,unit_cents,quantity,starts_on,billing_day,net_days,active,auto_send)
 values(p_data->>'name',p_data->>'email',p_data->>'address',p_data->>'reference',p_data->>'pricing',(p_data->>'unit_cents')::bigint,(p_data->>'quantity')::integer,(p_data->>'starts_on')::date,(p_data->>'billing_day')::integer,(p_data->>'net_days')::integer,(p_data->>'active')::boolean,(p_data->>'auto_send')::boolean) returning to_jsonb(finance_customers.*) into result;
 else
 update finance_customers set name=p_data->>'name',email=p_data->>'email',address=p_data->>'address',reference=p_data->>'reference',pricing=p_data->>'pricing',unit_cents=(p_data->>'unit_cents')::bigint,quantity=(p_data->>'quantity')::integer,starts_on=(p_data->>'starts_on')::date,billing_day=(p_data->>'billing_day')::integer,net_days=(p_data->>'net_days')::integer,active=(p_data->>'active')::boolean,auto_send=(p_data->>'auto_send')::boolean,updated_at=now() where id=v_id returning to_jsonb(finance_customers.*) into result;
 end if;
 elsif p_action='settings' then
 update finance_settings set company=p_data->>'company',contact_email=p_data->>'contact_email',payment_instructions=p_data->>'payment_instructions',updated_at=now() where id returning to_jsonb(finance_settings.*) into result;
 elsif p_action='expense' then
 insert into finance_expenses(vendor,description,category,total_cents,due_date) values(p_data->>'vendor',p_data->>'description',p_data->>'category',(p_data->>'total_cents')::bigint,(p_data->>'due_date')::date) returning to_jsonb(finance_expenses.*) into result;
 elsif p_action in ('issue','void') then
 select * into r from finance_invoices where id=v_id for update;
 if not found then raise exception 'Invoice not found'; end if;
 if p_action='issue' and r.status<>'draft' then raise exception 'Only drafts can be issued'; end if;
 if p_action='void' and (r.paid_cents>0 or exists(select 1 from finance_deliveries where invoice_id=v_id and status='sending')) then raise exception 'An invoice with payments or an email in progress cannot be voided'; end if;
 update finance_invoices set snapshot=case when p_action='issue' then snapshot || (select jsonb_build_object('company',company,'contact_email',contact_email,'payment_instructions',payment_instructions) from finance_settings where id) else snapshot end, status=case when p_action='issue' then 'issued' else 'void' end where id=v_id returning to_jsonb(finance_invoices.*) into result;
 elsif p_action='payment' then
 select to_jsonb(finance_payments.*) into result from finance_payments where request_id=(p_data->>'request_id')::uuid;
 if result is not null then return result; end if;
 amount:=(p_data->>'amount_cents')::bigint;
 if p_data->>'kind'='invoice' then
 select * into r from finance_invoices where id=v_id for update;
 if not found or r.status<>'issued' then raise exception 'An issued invoice is required'; end if;
 if (p_data->>'paid_on')::date<r.issue_date then raise exception 'Payment date cannot precede invoice issue date'; end if;
 if amount<=0 or amount>r.total_cents-r.paid_cents then raise exception 'Payment exceeds the remaining balance'; end if;
 update finance_invoices set paid_cents=paid_cents+amount where id=v_id;
 insert into finance_payments(invoice_id,amount_cents,paid_on,reference,note,request_id,created_by) values(v_id,amount,(p_data->>'paid_on')::date,p_data->>'reference',p_data->>'note',(p_data->>'request_id')::uuid,p_actor) returning to_jsonb(finance_payments.*) into result;
 else
 select * into e from finance_expenses where id=v_id for update;
 if not found or e.status<>'open' then raise exception 'An open company bill is required'; end if;
 if amount<=0 or amount>e.total_cents-e.paid_cents then raise exception 'Payment exceeds the remaining balance'; end if;
 update finance_expenses set paid_cents=paid_cents+amount where id=v_id;
 insert into finance_payments(expense_id,amount_cents,paid_on,reference,note,request_id,created_by) values(v_id,amount,(p_data->>'paid_on')::date,p_data->>'reference',p_data->>'note',(p_data->>'request_id')::uuid,p_actor) returning to_jsonb(finance_payments.*) into result;
 end if;
 else raise exception 'Unknown finance operation'; end if;
 if result is null then raise exception 'Record not found'; end if;
 insert into finance_audit(actor,action,record_id,details) values(p_actor,p_action,coalesce(v_id,(result->>'id')::uuid),p_data);
 return result;
end $$;

-- Freeze the provider payload and claim one delivery per invoice. An uncertain request older
-- than the provider's 24-hour idempotency window requires review instead of risking a duplicate.
create or replace function public.finance_claim_delivery(p_invoice uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare r finance_invoices; d finance_deliveries; begin
 select * into r from finance_invoices where id=p_invoice for update;
 if not found or r.status<>'issued' then raise exception 'Only issued invoices can be emailed'; end if;
 insert into finance_deliveries(invoice_id,payload) values(p_invoice,p_payload) on conflict do nothing;
 select * into d from finance_deliveries where invoice_id=p_invoice for update;
 if d.status in ('sent','needs_review') then return jsonb_build_object('claimed',false,'status',d.status); end if;
 if d.status='sending' and d.claimed_at>now()-interval '15 minutes' then return jsonb_build_object('claimed',false,'status','sending'); end if;
 if d.first_attempt_at<now()-interval '23 hours' then
 update finance_deliveries set status='needs_review',error='Delivery outcome requires review before another email can be attempted.',updated_at=now() where invoice_id=p_invoice;
 return jsonb_build_object('claimed',false,'status','needs_review');
 end if;
 update finance_deliveries set status='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),claimed_at=now(),updated_at=now() where invoice_id=p_invoice returning * into d;
 return jsonb_build_object('claimed',true,'payload',d.payload);
end $$;
revoke all on function public.finance_generate_cycle(date,boolean,uuid),public.finance_mutate(text,jsonb,uuid),public.finance_claim_delivery(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finance_generate_cycle(date,boolean,uuid),public.finance_mutate(text,jsonb,uuid),public.finance_claim_delivery(uuid,jsonb) to service_role;
