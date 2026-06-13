-- ===========================================================================
-- Per-player scoring rebuild. Run ONCE in the Supabase SQL Editor.
-- This is NON-DESTRUCTIVE: your existing `matches` table is left untouched as
-- a backup. After running this, deploy the new code and click
-- "Rebuild from old games" in the admin panel to populate the new table.
-- ===========================================================================

-- 1) stored Elo on each player (baseline 1000)
alter table players add column if not exists elo numeric not null default 1000;

-- 2) one row per player per game
create table if not exists game_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,                 -- groups the participants of one game
  username text not null,
  game_type text not null,               -- 'x01' | 'cricket' | 'baseball'
  config jsonb not null default '{}',
  winner text not null,                  -- denormalized so each row is self-contained
  result text not null,                  -- 'win' | 'loss'
  opponents jsonb not null default '[]', -- array of the other usernames
  stats jsonb not null default '{}',     -- this player's per-player stats
  elo_after numeric not null default 1000,
  completed_at timestamptz not null default now()
);

create index if not exists game_results_username_idx on game_results (username);
create index if not exists game_results_game_idx on game_results (game_id);
create index if not exists game_results_completed_idx on game_results (completed_at);

alter table game_results enable row level security;

drop policy if exists "members read results" on game_results;
create policy "members read results"
  on game_results for select to authenticated using (true);

drop policy if exists "members add results" on game_results;
create policy "members add results"
  on game_results for insert to authenticated with check (true);
