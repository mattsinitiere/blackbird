-- Run this ONCE in the Supabase SQL Editor (New query -> paste -> Run).
-- Adds the "hidden" flag used to keep guests and opted-out players off the leaderboard.

alter table players add column if not exists hidden boolean not null default false;

-- allow signed-in members to update a player's visibility (e.g. hide themselves)
drop policy if exists "members update players" on players;
create policy "members update players"
  on players for update to authenticated using (true) with check (true);
