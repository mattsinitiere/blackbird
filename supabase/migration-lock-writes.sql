-- Lock down writes: members can only change their own player row; only the
-- admin (lib/constants.js ADMIN_EMAIL) can change anyone else's. Games and
-- Elo are saved by the server (app/api/record-game), never the browser.
--
-- Before this, any signed-in member could PATCH any player's elo, username,
-- hidden flag or auth_id straight through the REST API with the public anon
-- key, and insert made-up game results for anyone.
--
-- Run it LAST, after every other migration (it follows
-- migration-search-paths.sql), and only once the app with
-- app/api/record-game is deployed. Run it the other way round and games
-- finished in between fail to save; they wait in the phone's queue and go
-- through once the new app is live. Safe to run more than once.
--
-- players_guard_identity (migration-scoped-data.sql) guards auth_id and
-- renames too; the two agree, and this one is the stricter.

-- 1) who is the admin. security definer so it can read auth.users; it
--    returns only a yes/no for the calling session.
create or replace function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'matthews@finishessolutions.com'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2) players: members update only their own row, or claim an unclaimed
--    row (auth_id null -> their own id; step 3 limits which one). The
--    admin can update any row.
drop policy if exists "members update players" on players;
create policy "members update players"
  on players for update to authenticated
  using (auth_id = (select auth.uid()) or auth_id is null or (select public.is_admin()))
  with check (auth_id = (select auth.uid()) or (select public.is_admin()));

--    members add their own row or a guest row (no account); the admin
--    can add anything. Step 3 pins a member-added row's Elo to 1000.
drop policy if exists "members add players" on players;
create policy "members add players"
  on players for insert to authenticated
  with check (auth_id is null or auth_id = (select auth.uid()) or (select public.is_admin()));

-- 3) columns only the admin or the server may change. Signed-in members
--    who aren't the admin:
--      - can't change elo, username, id or created_at
--      - can set auth_id only to claim an unclaimed row carrying their own
--        display name, and only if they don't already have a row
--      - get elo 1000 on any row they add, and can't add a second row
--        linked to their account
--    The service role (server routes) and the SQL editor are not
--    affected: they have no auth.uid(), or run as role service_role.
create or replace function players_guard_core() returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
  my_name text;
begin
  if me is null or current_setting('role', true) = 'service_role' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.auth_id is not null and exists (select 1 from players p where p.auth_id = new.auth_id) then
      raise exception 'Your account already has a player' using errcode = '42501';
    end if;
    new.elo := 1000;
    return new;
  end if;

  if new.elo is distinct from old.elo
     or new.username is distinct from old.username
     or new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the admin can change a player''s rating or name'
      using errcode = '42501';
  end if;

  if new.auth_id is distinct from old.auth_id then
    select trim(coalesce(u.raw_user_meta_data->>'display_name', ''))
      into my_name
      from auth.users u where u.id = me;
    if old.auth_id is not null
       or new.auth_id is distinct from me
       or lower(new.username) <> lower(coalesce(my_name, ''))
       or exists (select 1 from players p where p.auth_id = me and p.id <> old.id) then
      raise exception 'You can only claim the player with your own name (auth_id)'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;
revoke all on function players_guard_core() from public, anon, authenticated;

drop trigger if exists players_guard_core on players;
create trigger players_guard_core
  before insert or update on players
  for each row execute function players_guard_core();

-- 4) game results and matches: no browser inserts. The server route
--    writes them with the service role, which RLS doesn't apply to.
drop policy if exists "members add results" on game_results;
drop policy if exists "members add matches" on matches;
