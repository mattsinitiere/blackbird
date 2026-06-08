-- ============================================================
-- Blackbird Dart Scoring System — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and run it.
-- ============================================================

-- Players: a shared list of dart competitors (names, not login accounts).
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamptz not null default now()
);

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
-- read and add data. (The Supabase dashboard always bypasses RLS,
-- so you can edit/delete rows there yourself if needed.)
-- ------------------------------------------------------------
alter table players enable row level security;
alter table matches enable row level security;

create policy "members read players"
  on players for select to authenticated using (true);
create policy "members add players"
  on players for insert to authenticated with check (true);

create policy "members read matches"
  on matches for select to authenticated using (true);
create policy "members add matches"
  on matches for insert to authenticated with check (true);
