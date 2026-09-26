-- ============================================================
-- Blackbird Dart Scoring System — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and run it.
-- ============================================================

-- Players: a shared list of dart competitors (names, not login accounts).
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamptz not null default now(),
  hidden boolean not null default false,
  elo numeric not null default 1000,
  color text,                              -- avatar color (hex)
  auth_id uuid,                            -- owning login account, once claimed
  handle text,                             -- @handle, unique (see migration-add-profile.sql)
  bio text,
  location text,
  tag text,                                -- name tag, 2-5 upper-case letters/digits
  tag_icon text,                           -- name tag icon id (see lib/profile.js TAG_ICONS)
  cover text                               -- profile cover id (see lib/covers.js), null = playon
);
alter table players drop constraint if exists players_tag_format;
alter table players add constraint players_tag_format
  check (tag is null or tag ~ '^[A-Z0-9]{2,5}$');
alter table players drop constraint if exists players_tag_icon_set;
alter table players add constraint players_tag_icon_set
  check (tag_icon is null or tag_icon in (
    'crown','flame','bolt','star','target','skull','bird','clover','diamond','anchor','ghost','rocket',
    'dart','trophy','medal','shield','heart','dice','compass','moon','sun','pint','paw','horseshoe'
  ));
alter table players drop constraint if exists players_cover_set;
alter table players add constraint players_cover_set
  check (cover is null or cover in ('playon','dartboard','flight','scoreboard','night','contours'));

-- Matches: one row per completed game.
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  game_type text not null,                 -- 'x01' | 'cricket'
  config jsonb not null default '{}',      -- { startScore, doubleOut } for x01
  players jsonb not null,                  -- array of usernames
  winner text not null,
  per_player jsonb not null,               -- { username: { ...stats } }
  completed_at timestamptz not null default now()
);

create index if not exists matches_completed_at_idx on matches (completed_at);

-- ------------------------------------------------------------
-- Row Level Security: any signed-in member of your group can
-- read data; writes are limited (see migration-lock-writes.sql,
-- which you must run on a fresh install for members to add or edit
-- players). (The Supabase dashboard always bypasses RLS, so you
-- can edit/delete rows there yourself if needed.)
-- ------------------------------------------------------------
alter table players enable row level security;
alter table matches enable row level security;

create policy "members read players"
  on players for select to authenticated using (true);
-- insert/update on players: owner or admin only, in migration-lock-writes.sql

create policy "members read matches"
  on matches for select to authenticated using (true);

-- One row per player per game (per-player scoring).
create table if not exists game_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  username text not null,
  game_type text not null,
  config jsonb not null default '{}',
  winner text not null,
  result text not null,
  opponents jsonb not null default '[]',
  stats jsonb not null default '{}',
  elo_after numeric not null default 1000,
  completed_at timestamptz not null default now()
);
create index if not exists game_results_username_idx on game_results (username);
create index if not exists game_results_game_idx on game_results (game_id);
create unique index if not exists game_results_game_user_idx on game_results (game_id, username);
alter table game_results enable row level security;

-- Friends: an account follows player rows. You read your own result rows
-- and the rows of players you follow; anyone may insert (whoever finishes
-- a game writes every participant's row).
create table if not exists follows (
  follower   uuid not null references auth.users (id) on delete cascade,
  followed   uuid not null references players (id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followed)
);
create index if not exists follows_followed_idx on follows (followed);
create index if not exists players_auth_id_idx  on players (auth_id);
alter table follows enable row level security;
create policy "members read own follows"
  on follows for select to authenticated
  using (follower = (select auth.uid())
      or followed in (select p.id from players p where p.auth_id = (select auth.uid())));
create policy "members follow"
  on follows for insert to authenticated
  with check (follower = (select auth.uid())
      and not exists (select 1 from players p where p.id = followed and p.auth_id = (select auth.uid())));
create policy "members unfollow"
  on follows for delete to authenticated
  using (follower = (select auth.uid()));

create policy "members read results"
  on game_results for select to authenticated
  using (username in (
    select p.username from players p
    where p.auth_id = (select auth.uid())
       or p.id in (select f.followed from follows f where f.follower = (select auth.uid()))));
-- no insert policy: games are saved by app/api/record-game (service role)

-- Profile fields: unique @handle + owner-only edits.
-- (Full details and the backfill live in migration-add-profile.sql; run that
-- file too on a fresh install, then migration-follows-tags.sql for the
-- tag-aware owner guard.)
