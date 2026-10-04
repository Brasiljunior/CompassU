-- Server-only edits; lock the bill before its payment to match payment creation.
create or replace function public.finance_edit_bill(p_action text,p_data jsonb,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e finance_expenses; p finance_payments; v_id uuid:=(p_data->>'id')::uuid; bill_id uuid; amount bigint; before_data jsonb; result jsonb;
begin
 if p_actor is null or not exists(select 1 from admin_users where user_id=p_actor and role='master_admin') then raise exception 'Master administrator required'; end if;
 if p_action='expense_edit' then bill_id:=v_id;
 elsif p_action='expense_payment_edit' then
 select expense_id into bill_id from finance_payments where id=v_id;
 if bill_id is null then raise exception 'Company bill payment not found'; end if;
 else raise exception 'Unknown bill edit operation'; end if;
 select * into e from finance_expenses where id=bill_id for update;
 if not found or e.status<>'open' then raise exception 'Company bill not found'; end if;
 if p_action='expense_edit' then
 before_data:=to_jsonb(e);
 if p_data->'expected' is distinct from (before_data - 'created_at' - 'paid_cents') then raise exception 'This bill changed. Close the form, refresh, and try again.'; end if;
 amount:=(p_data->>'total_cents')::bigint;
 if amount is null or amount<=0 or amount<e.paid_cents then raise exception 'Bill total cannot be less than payments already recorded'; end if;
 update finance_expenses set vendor=p_data->>'vendor',description=p_data->>'description',category=p_data->>'category',total_cents=amount,due_date=(p_data->>'due_date')::date where id=bill_id returning to_jsonb(finance_expenses.*) into result;
 else
 select * into p from finance_payments where id=v_id and expense_id=bill_id for update;
 if not found then raise exception 'Company bill payment not found'; end if;
 before_data:=to_jsonb(p);
 if p_data->'expected' is distinct from before_data then raise exception 'This payment changed. Close the form, refresh, and try again.'; end if;
 amount:=(p_data->>'amount_cents')::bigint;
 if amount is null or amount<=0 or amount>e.total_cents-e.paid_cents+p.amount_cents then raise exception 'Payment exceeds the bill balance available for this correction'; end if;
 if (p_data->>'paid_on')::date>(now() at time zone 'America/Chicago')::date then raise exception 'Payment date cannot be in the future'; end if;
 update finance_expenses set paid_cents=paid_cents-p.amount_cents+amount where id=bill_id;
 update finance_payments set amount_cents=amount,paid_on=(p_data->>'paid_on')::date,reference=p_data->>'reference',note=p_data->>'note' where id=v_id returning to_jsonb(finance_payments.*) into result;
 end if;
 insert into finance_audit(actor,action,record_id,details) values(p_actor,p_action,v_id,jsonb_build_object('before',before_data,'after',result));
 return result;
end $$;
revoke all on function public.finance_edit_bill(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.finance_edit_bill(text,jsonb,uuid) to service_role;
