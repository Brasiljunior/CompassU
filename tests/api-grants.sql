-- Run only in the disposable recovery branch. All fixtures are rolled back.
begin;
select set_config('test.student',gen_random_uuid()::text,true),
       set_config('test.admin',gen_random_uuid()::text,true),
       set_config('test.attempt',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('test.student')::uuid,'grants-student@example.invalid'),
 (current_setting('test.admin')::uuid,'grants-admin@example.invalid');
insert into public.admin_users(user_id,role) values(current_setting('test.admin')::uuid,'master_admin');
insert into public.assessment_questions(question_number,dimension,question_text)
select n,'interests','Synthetic permission test '||n from generate_series(1,80) n;
insert into public.question_trait_weights(question_id,trait_code,weight)
select id,'quantitative',1 from public.assessment_questions;
insert into public.majors(name,career_cluster) values('Permission test major','STEM');
insert into public.major_trait_weights(major_id,trait_code,weight)
select id,'quantitative',1 from public.majors where name='Permission test major';

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true);
insert into public.profiles(id,first_name) values(current_setting('test.student')::uuid,'Permission');
insert into public.assessment_attempts(id,user_id) values(current_setting('test.attempt')::uuid,current_setting('test.student')::uuid);
insert into public.assessment_responses(attempt_id,user_id,question_id,response_value)
select current_setting('test.attempt')::uuid,current_setting('test.student')::uuid,id,'{"value":4}' from public.assessment_questions;
select * from public.finalize_assessment(current_setting('test.attempt')::uuid);
do $$ begin
 if not exists(select 1 from public.assessment_attempts where status='completed') then raise exception 'Finalization failed'; end if;
 if not exists(select 1 from public.major_matches) then raise exception 'Matches missing'; end if;
 if public.is_compassu_admin() then raise exception 'Student elevated'; end if;
 begin
   perform public.get_institutional_analytics(null);
   raise exception 'Student analytics allowed';
 exception when raise_exception then
   if sqlerrm='Student analytics allowed' then raise; end if;
 end;
 begin
   perform 1 from public.finance_expenses;
   raise exception 'Student finance allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
insert into public.user_major_favorites(user_id,major_id)
select current_setting('test.student')::uuid,major_id from public.major_matches;
delete from public.user_major_favorites where user_id=current_setting('test.student')::uuid;
-- A different signed-in user cannot read the student's records.
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$ begin
 if exists(select 1 from public.assessment_attempts where id=current_setting('test.attempt')::uuid) then raise exception 'Cross-user assessment leak'; end if;
 if not public.is_compassu_master_admin() then raise exception 'Admin access lost'; end if;
 if not exists(select 1 from public.get_compassu_admin_context()) then raise exception 'Admin context missing'; end if;
end $$;
reset role;

set local role service_role;
do $$ declare a uuid:=current_setting('test.admin')::uuid; b jsonb; bill uuid; payment jsonb; begin
 insert into public.invitation_reminders(email,invited_at) values('grants-reminder@example.invalid',now()-interval '3 days');
 if not exists(select 1 from public.claim_invitation_reminders(100) where email='grants-reminder@example.invalid') then raise exception 'Reminder claim failed'; end if;
 update public.invitation_reminders set reminders_sent=1 where email='grants-reminder@example.invalid';
 b:=public.finance_mutate('expense','{"vendor":"Permission test","description":"Rollback only","category":"Operations","total_cents":10000,"due_date":"2026-10-21"}',a);
 bill:=(b->>'id')::uuid;
 perform public.finance_register_receipt(bill,bill::text||'/test.pdf','test.pdf','application/pdf',100,a);
 payment:=public.finance_mutate('payment',jsonb_build_object('id',bill,'kind','expense','amount_cents',1000,'paid_on','2026-10-21','reference','','note','','request_id',gen_random_uuid()),a);
 if (select paid_cents from public.finance_expenses where id=bill)<>1000 then raise exception 'Payment failed'; end if;
 perform public.finance_edit_bill('expense_edit',jsonb_build_object('id',bill,'vendor','Updated test','description','Rollback only','category','Operations','total_cents',11000,'due_date','2026-10-21','expected',b-'created_at'-'paid_cents'),a);
end $$;
reset role;

do $$ declare r record; begin
 for r in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' loop
   if not has_table_privilege('service_role',r.oid,'SELECT') or not has_table_privilege('service_role',r.oid,'INSERT') or not has_table_privilege('service_role',r.oid,'UPDATE') or not has_table_privilege('service_role',r.oid,'DELETE') then raise exception 'Server grant missing: %',r.relname; end if;
   if has_table_privilege('authenticated',r.oid,'TRUNCATE') or has_table_privilege('anon',r.oid,'TRUNCATE') then raise exception 'Browser truncate: %',r.relname; end if;
 end loop;
 if has_table_privilege('anon','public.finance_expense_receipts','SELECT') or has_table_privilege('authenticated','public.finance_expense_receipts','SELECT') then raise exception 'Receipt metadata exposed'; end if;
end $$;
select 'PASS: assessment, isolation, admin access, reminders, bills, receipts, payments, edits, and privilege assertions' as verification;
rollback;
