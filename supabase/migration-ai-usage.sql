-- Daily Blackbird AI allowance (app/api/insights/route.js). Each account
-- may make p_limit AI requests per day (Central time); the developer
-- account is never counted. Players can read their own row but cannot
-- write it: only ai_take_request (security definer) changes counts.
-- Safe to run more than once.
create table if not exists ai_usage (
  auth_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (auth_id, day)
);

alter table ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on ai_usage;
create policy "ai_usage_select_own" on ai_usage
  for select to authenticated using (auth_id = auth.uid());

-- Take one request from today's allowance. Returns the requests left
-- after this one, -1 when the allowance is already used up (nothing is
-- counted then), or null for the developer (unlimited).
create or replace function ai_take_request(p_limit int default 50)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Chicago')::date;
  used int;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users u where u.id = uid and lower(u.email) = 'matthews@finishessolutions.com') then
    return null;
  end if;
  insert into ai_usage (auth_id, day, count) values (uid, today, 0)
    on conflict (auth_id, day) do nothing;
  update ai_usage set count = count + 1
    where auth_id = uid and day = today and count < p_limit
    returning count into used;
  if used is null then
    return -1;
  end if;
  return p_limit - used;
end $$;

revoke all on function ai_take_request(int) from public, anon;
grant execute on function ai_take_request(int) to authenticated;
