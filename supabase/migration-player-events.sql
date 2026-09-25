-- Private activity log for achievements that can't be derived from games:
-- the days a player opened the app (login streaks) and when they first
-- customised each part of their profile. Each user reads and writes only
-- their own rows. Safe to run more than once.
create table if not exists player_events (
  id bigserial primary key,
  auth_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('visit', 'profile')),
  detail text not null default '',
  day date not null,
  created_at timestamptz not null default now(),
  unique (auth_id, kind, detail, day)
);

create index if not exists player_events_auth_idx on player_events (auth_id, kind, day);

alter table player_events enable row level security;

drop policy if exists "player_events_select_own" on player_events;
create policy "player_events_select_own" on player_events
  for select to authenticated using (auth_id = auth.uid());

drop policy if exists "player_events_insert_own" on player_events;
create policy "player_events_insert_own" on player_events
  for insert to authenticated with check (auth_id = auth.uid());
