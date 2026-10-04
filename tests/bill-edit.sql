begin;
do $$ declare a uuid; b jsonb; p jsonb; e uuid; expected_bill jsonb; rejected boolean; begin
 select user_id into a from admin_users where role='master_admin' limit 1;
 b:=finance_mutate('expense','{"vendor":"Edit test","description":"Rollback verification","category":"Operations","total_cents":10000,"due_date":"2026-10-04"}',a); e:=(b->>'id')::uuid;
 p:=finance_mutate('payment',jsonb_build_object('id',e,'kind','expense','amount_cents',4000,'paid_on','2026-10-04','reference','','note','','request_id',gen_random_uuid()),a);
 expected_bill:=b-'created_at'-'paid_cents';
 b:=finance_edit_bill('expense_edit',jsonb_build_object('id',e,'vendor','Updated vendor','description','Updated description','category','Technology','total_cents',12000,'due_date','2026-10-15','expected',expected_bill),a);
 if (b->>'paid_cents')::bigint<>4000 or b->>'vendor'<>'Updated vendor' then raise exception 'Bill edit failed'; end if;
 rejected:=false;begin perform finance_edit_bill('expense_edit',jsonb_build_object('id',e,'expected',b-'created_at'-'paid_cents','total_cents',3000),a);exception when others then rejected:=true;end;if not rejected then raise exception 'Total below paid accepted';end if;
 p:=finance_edit_bill('expense_payment_edit',jsonb_build_object('id',p->>'id','expected',p,'amount_cents',6000,'paid_on','2026-09-30','reference','Corrected','note','Correction'),a);
 if (select paid_cents from finance_expenses where id=e)<>6000 then raise exception 'Increase balance failed';end if;
 p:=finance_edit_bill('expense_payment_edit',jsonb_build_object('id',p->>'id','expected',p,'amount_cents',2000,'paid_on','2026-10-01','reference','','note',''),a);
 if (select paid_cents from finance_expenses where id=e)<>2000 then raise exception 'Decrease balance failed';end if;
 rejected:=false;begin perform finance_edit_bill('expense_payment_edit',jsonb_build_object('id',p->>'id','expected',p,'amount_cents',13000,'paid_on','2026-10-01','reference','','note',''),a);exception when others then rejected:=true;end;if not rejected then raise exception 'Overpayment accepted';end if;
 rejected:=false;begin perform finance_edit_bill('expense_payment_edit',jsonb_build_object('id',p->>'id','expected','{}'::jsonb,'amount_cents',2000,'paid_on','2026-10-01','reference','','note',''),a);exception when others then rejected:=true;end;if not rejected then raise exception 'Stale edit accepted';end if;
 if not exists(select 1 from finance_audit where record_id=(p->>'id')::uuid and details->'before' is not null and details->'after' is not null) then raise exception 'Missing audit';end if;
 if has_function_privilege('anon','finance_edit_bill(text,jsonb,uuid)','execute') or has_function_privilege('authenticated','finance_edit_bill(text,jsonb,uuid)','execute') then raise exception 'Public edit privilege';end if;
end $$;
rollback;
