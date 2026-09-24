-- ============================================================
-- Friends (one-way follow), name tags, and follow-scoped result visibility
-- Safe to re-run. Run once in the Supabase SQL Editor after
-- migration-add-profile.sql.
-- ============================================================

-- ---------- 1) follows: an account follows a player row ----------
create table if not exists follows (
  follower   uuid not null references auth.users (id) on delete cascade,  -- auth.uid()
  followed   uuid not null references players (id)   on delete cascade,   -- players.id
  created_at timestamptz not null default now(),
  primary key (follower, followed)
);
create index if not exists follows_followed_idx on follows (followed);
create index if not exists players_auth_id_idx  on players (auth_id);

alter table follows enable row level security;

drop policy if exists "members read own follows" on follows;
create policy "members read own follows"
  on follows for select to authenticated
  using (
    follower = (select auth.uid())
    or followed in (select p.id from players p where p.auth_id = (select auth.uid()))
  );

drop policy if exists "members follow" on follows;
create policy "members follow"
  on follows for insert to authenticated
  with check (
    follower = (select auth.uid())
    and not exists (select 1 from players p where p.id = followed and p.auth_id = (select auth.uid()))
  );

drop policy if exists "members unfollow" on follows;
create policy "members unfollow"
  on follows for delete to authenticated
  using (follower = (select auth.uid()));

-- ---------- 2) game_results: read only yourself + who you follow ----------
-- The subquery does not depend on the row, so Postgres evaluates it once
-- per statement and filters rows by username. The service role bypasses
-- RLS. The insert policy "members add results" (with check true) is
-- intentionally unchanged: whoever finishes a game writes every
-- participant's row.
drop policy if exists "members read results" on game_results;
create policy "members read results"
  on game_results for select to authenticated
  using (
    username in (
      select p.username from players p
      where p.auth_id = (select auth.uid())
         or p.id in (select f.followed from follows f where f.follower = (select auth.uid()))
    )
  );

-- One row per player per game: a retried save fails loudly (23505) instead
-- of duplicating when the scorer cannot read the first insert.
do $$
begin
  if exists (select 1 from game_results group by game_id, username having count(*) > 1) then
    raise notice 'game_results has duplicate (game_id, username) rows; unique index skipped';
  else
    create unique index if not exists game_results_game_user_idx on game_results (game_id, username);
  end if;
end $$;

-- ---------- 3) tags ----------
alter table players add column if not exists tag text;
alter table players add column if not exists tag_icon text;

alter table players drop constraint if exists players_tag_format;
alter table players add constraint players_tag_format
  check (tag is null or tag ~ '^[A-Z0-9]{2,5}$');

alter table players drop constraint if exists players_tag_icon_set;
alter table players add constraint players_tag_icon_set
  check (tag_icon is null or tag_icon in (
    'crown','flame','bolt','star','target','skull','bird','clover','diamond','anchor','ghost','rocket'
  ));

-- owner-only edits now also cover tag / tag_icon (same semantics as before)
create or replace function players_guard_profile() returns trigger
language plpgsql as $$
begin
  if (new.handle   is distinct from old.handle
      or new.bio      is distinct from old.bio
      or new.location is distinct from old.location
      or new.tag      is distinct from old.tag
      or new.tag_icon is distinct from old.tag_icon)
     and old.auth_id is not null
     and auth.uid() is not null
     and old.auth_id <> auth.uid() then
    raise exception 'Only the profile owner can edit handle, bio, location and tag'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists players_guard_profile on players;
create trigger players_guard_profile
  before update on players
  for each row execute function players_guard_profile();

-- ---------- 4) seed: linked accounts follow each other (re-runnable) ----------
-- Every account with a login follows every OTHER player row that has a
-- login, so nobody's standings go empty on migration day. Guest rows
-- (no login) are not followed; their history shows once someone follows
-- them.
insert into follows (follower, followed)
select a.auth_id, b.id
from players a
join players b on b.auth_id is not null and b.auth_id <> a.auth_id
where a.auth_id is not null
  and exists (select 1 from auth.users u where u.id = a.auth_id)
on conflict do nothing;
