create table if not exists public.invitation_reminders (
  email text primary key,
  user_id uuid,
  first_name text not null default '',
  invited_at timestamptz not null default now(),
  reminders_sent integer not null default 0 check (reminders_sent between 0 and 2),
  claimed_at timestamptz,
  last_sent_at timestamptz
);
alter table public.invitation_reminders enable row level security;
revoke all on public.invitation_reminders from anon, authenticated;
create index if not exists invitation_reminders_due_idx on public.invitation_reminders (invited_at) where reminders_sent < 2;

create or replace function public.claim_invitation_reminders(p_limit integer default 100)
returns setof public.invitation_reminders language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select email from public.invitation_reminders
    where reminders_sent < 2
      and invited_at + case when reminders_sent = 0 then interval '2 days' else interval '4 days' end <= now()
      and (claimed_at is null or claimed_at < now() - interval '15 minutes')
    order by invited_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  update public.invitation_reminders r set claimed_at = now()
  from due where r.email = due.email returning r.*;
end $$;
revoke all on function public.claim_invitation_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_invitation_reminders(integer) to service_role;
