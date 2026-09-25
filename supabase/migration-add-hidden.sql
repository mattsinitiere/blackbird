-- Run this ONCE in the Supabase SQL Editor (New query -> paste -> Run).
-- Adds the "hidden" flag used to keep guests and opted-out players off the leaderboard.

alter table players add column if not exists hidden boolean not null default false;

-- The players UPDATE policy (owner or admin only) lives in
-- migration-lock-writes.sql. This file used to create an open one
-- (using (true)); it no longer touches the policy, so re-running it is safe.
