-- ============================================================
-- Server-side game saves and write lockdown.
--
-- Until now the browser inserted every participant's result row and wrote
-- each player's new Elo straight into `players`, and RLS allowed any
-- member to do both for anyone. This migration moves saving into one
-- function, record_game(), that runs as a single transaction:
--   - the caller must have played in the game, or follow every person in it
--     (scoring a game between friends at the board);
--   - game type, players, winner and the stats size are checked;
--   - completed_at can't be in the future;
--   - Elo is computed here from the players' current ratings, with their
--     rows locked, so two games finishing at once can't overwrite each
--     other and a retried save never applies Elo twice;
--   - a game id that's already saved returns 'duplicate' and changes nothing.
-- Then direct result inserts, Elo writes, edits to rows that belong to
-- another account, and inserts into the legacy `matches` table are closed.
--
-- ORDER: deploy the app first (it calls record_game and falls back to the
-- old direct writes only while this function doesn't exist), then run this
-- in the Supabase SQL Editor. Safe to run more than once.
-- ============================================================

-- ---------- 1) record_game ----------
create or replace function record_game(p_game jsonb) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
  k constant numeric := 24;          -- lib/constants.js ELO_K
  base constant numeric := 1000;     -- lib/constants.js BASE_ELO
  v_game_id uuid;
  v_type text := p_game->>'game_type';
  v_config jsonb := coalesce(p_game->'config', '{}'::jsonb);
  v_stats jsonb := coalesce(p_game->'stats', '{}'::jsonb);
  v_winner text := nullif(p_game->>'winner', '');
  v_completed timestamptz;
  v_players text[];
  v_humans text[];
  v_ranked boolean;
  v_rating jsonb := '{}'::jsonb;
  v_out jsonb := '{}'::jsonb;
  v_known int;
  u text;
  l text;
  rw numeric;
  rl numeric;
  delta numeric;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- shape
  begin
    v_game_id := (p_game->>'game_id')::uuid;
  exception when others then
    raise exception 'record_game: game_id must be a uuid' using errcode = '22023';
  end;
  if v_game_id is null then
    raise exception 'record_game: game_id is required' using errcode = '22023';
  end if;
  if v_type is null or v_type not in ('x01', 'cricket', 'baseball', 'aroundTheClock', 'killer', 'shanghai', 'halveit', 'gotcha', 'tictactoe', 'bobs27', 'checkoutDrill', 'scoringDrill') then
    raise exception 'record_game: unknown game type %', coalesce(v_type, 'null') using errcode = '22023';
  end if;
  if jsonb_typeof(p_game->'players') is distinct from 'array' then
    raise exception 'record_game: players must be an array' using errcode = '22023';
  end if;
  v_players := array(select x from jsonb_array_elements_text(p_game->'players') with ordinality t(x, i) order by i);
  if coalesce(array_length(v_players, 1), 0) not between 1 and 8
     or (select count(distinct x) from unnest(v_players) x) <> array_length(v_players, 1)
     or exists (select 1 from unnest(v_players) x where x is null or char_length(x) not between 1 and 40) then
    raise exception 'record_game: 1 to 8 distinct players' using errcode = '22023';
  end if;
  v_humans := array(select x from unnest(v_players) with ordinality t(x, i) where x not like 'bot:%' order by i);
  if coalesce(array_length(v_humans, 1), 0) = 0 then
    raise exception 'record_game: no human players' using errcode = '22023';
  end if;
  if v_winner is null or not (v_winner = any (v_players)) then
    raise exception 'record_game: the winner must be one of the players' using errcode = '22023';
  end if;
  if pg_column_size(p_game) > 2 * 1024 * 1024 then
    raise exception 'record_game: game too large' using errcode = '54000';
  end if;
  v_completed := least(coalesce((p_game->>'completed_at')::timestamptz, now()), now());

  -- the same rule as lib/practice.js isRankedMatch
  v_ranked := array_length(v_players, 1) >= 2
    and array_length(v_humans, 1) = array_length(v_players, 1)
    and v_type not in ('bobs27', 'checkoutDrill', 'scoringDrill');

  -- every person must be a real player row
  select count(*) into v_known from players where username = any (v_humans);
  if v_known <> array_length(v_humans, 1) then
    raise exception 'record_game: unknown player' using errcode = '22023';
  end if;

  -- who may save it: someone who played, or who follows everyone who did
  if not exists (select 1 from players p where p.auth_id = me and p.username = any (v_humans))
     and exists (
       select 1 from unnest(v_humans) h
       where h not in (
         select p.username from players p
         where p.auth_id = me
            or p.id in (select f.followed from follows f where f.follower = me)
       )
     ) then
    raise exception 'record_game: you can only save games you played or scored for friends you follow' using errcode = '42501';
  end if;

  -- lock the players' rows: concurrent saves for the same people queue here
  -- (a stable order avoids deadlocks), and the duplicate check below then
  -- sees any game that finished first
  perform 1 from players where username = any (v_humans) order by username for update;

  if exists (select 1 from game_results where game_id = v_game_id) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  for u in select username from players where username = any (v_humans) loop
    v_rating := v_rating || jsonb_build_object(u, (select coalesce(elo, base) from players where username = u));
  end loop;

  -- lib/stats.js applyEloUpdate: the winner against each loser in throw order
  if v_ranked then
    foreach l in array v_humans loop
      continue when l = v_winner;
      rw := (v_rating->>v_winner)::numeric;
      rl := (v_rating->>l)::numeric;
      delta := k * (1 - 1 / (1 + power(10::numeric, (rl - rw) / 400)));
      v_rating := v_rating || jsonb_build_object(v_winner, rw + delta, l, rl - delta);
    end loop;
  end if;

  foreach u in array v_humans loop
    if pg_column_size(coalesce(v_stats->u, '{}'::jsonb)) > 512 * 1024 then
      raise exception 'record_game: stats for % too large', u using errcode = '54000';
    end if;
    insert into game_results (game_id, username, game_type, config, winner, result, opponents, stats, elo_after, completed_at)
    values (
      v_game_id, u, v_type, v_config, v_winner,
      case when not v_ranked then 'practice' when u = v_winner then 'win' else 'loss' end,
      to_jsonb(array(select x from unnest(v_players) with ordinality t(x, i) where x <> u order by i)),
      coalesce(v_stats->u, '{}'::jsonb),
      round((v_rating->>u)::numeric),
      v_completed
    );
    v_out := v_out || jsonb_build_object(u, round((v_rating->>u)::numeric));
  end loop;

  if v_ranked then
    perform set_config('blackbird.trusted_write', 'on', true);
    update players p set elo = round((v_rating->>p.username)::numeric) where p.username = any (v_humans);
    perform set_config('blackbird.trusted_write', '', true);
  end if;

  return jsonb_build_object('status', 'saved', 'ranked', v_ranked, 'elo', v_out);
end $$;

revoke all on function record_game(jsonb) from public, anon;
grant execute on function record_game(jsonb) to authenticated;

-- ---------- 2) Elo moves only through record_game ----------
-- The service role and SQL editor (no auth.uid()) can still correct it.
create or replace function players_guard_elo() returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if auth.uid() is null or coalesce(current_setting('blackbird.trusted_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.elo := 1000; -- a new player starts at the base rating
    return new;
  end if;
  if new.elo is distinct from old.elo then
    raise exception 'Elo changes only when a game is saved' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists players_guard_elo on players;
create trigger players_guard_elo
  before insert or update on players
  for each row execute function players_guard_elo();

-- ---------- 3) members edit only their own row, or an unlinked guest ----------
drop policy if exists "members update players" on players;
drop policy if exists "members update own or guest players" on players;
create policy "members update own or guest players"
  on players for update to authenticated
  using (auth_id = (select auth.uid()) or auth_id is null)
  with check (auth_id = (select auth.uid()) or auth_id is null);

-- usernames: short, and never in the bot namespace. NOT VALID leaves any
-- existing row alone; new names and renames are checked.
alter table players drop constraint if exists players_username_format;
alter table players add constraint players_username_format
  check (char_length(btrim(username)) between 1 and 32 and username !~* '^bot:') not valid;

-- ---------- 4) results are written only by record_game ----------
drop policy if exists "members add results" on game_results;
alter table game_results drop constraint if exists game_results_result_set;
alter table game_results add constraint game_results_result_set
  check (result in ('win', 'loss', 'practice')) not valid;

-- ---------- 5) the legacy matches table is read-only ----------
drop policy if exists "members add matches" on matches;

-- ---------- 6) visit days can't be back-filled ----------
-- Streak badges count the days a player opened the app. The client sends
-- its local date, so allow a day either side of the server's for time
-- zones, and nothing older.
create or replace function player_events_guard_day() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.day < current_date - 1 or new.day > current_date + 1 then
    raise exception 'Activity can only be logged for today' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists player_events_guard_day on player_events;
create trigger player_events_guard_day
  before insert or update on player_events
  for each row execute function player_events_guard_day();

-- ---------- 7) redundant indexes ----------
-- (username, completed_at, id) covers lookups by username; the unique
-- (game_id, username) index covers lookups by game, when it exists.
drop index if exists game_results_username_idx;
do $$
begin
  if exists (select 1 from pg_indexes where indexname = 'game_results_game_user_idx') then
    drop index if exists game_results_game_idx;
  end if;
end $$;
