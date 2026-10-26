-- record_game: who may save, Elo on the server, idempotency, lockdown.
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-0000000000a1', 'amy@test'),
  ('b1000000-0000-0000-0000-0000000000b1', 'ben@test'),
  ('e1000000-0000-0000-0000-0000000000e1', 'eve@test');
insert into players (username, auth_id) values
  ('Amy', 'a1000000-0000-0000-0000-0000000000a1'),
  ('Ben', 'b1000000-0000-0000-0000-0000000000b1'),
  ('Eve', 'e1000000-0000-0000-0000-0000000000e1');

set role authenticated;
set request.jwt.claim.sub = 'a1000000-0000-0000-0000-0000000000a1';
do $$
declare r jsonb;
begin
  -- Amy beats Ben: both start at 1000, winner +12, loser -12
  r := record_game('{"game_id":"11111111-0000-0000-0000-000000000001","game_type":"x01","config":{"startScore":501},"players":["Amy","Ben"],"winner":"Amy","completed_at":"2026-10-01T20:00:00Z","stats":{"Amy":{"dartsThrown":18},"Ben":{"dartsThrown":18}}}');
  assert r->>'status' = 'saved', 'saved: ' || r::text;
  assert (r->'elo'->>'Amy')::int = 1012 and (r->'elo'->>'Ben')::int = 988, 'elo: ' || r::text;
  -- the same game again changes nothing
  r := record_game('{"game_id":"11111111-0000-0000-0000-000000000001","game_type":"x01","players":["Amy","Ben"],"winner":"Amy","stats":{}}');
  assert r->>'status' = 'duplicate', 'duplicate: ' || r::text;
  -- a bot game is practice and leaves Elo alone; a future date is clamped
  r := record_game('{"game_id":"11111111-0000-0000-0000-000000000002","game_type":"cricket","players":["Amy","bot:raven"],"winner":"bot:raven","completed_at":"2099-01-01T00:00:00Z","stats":{"Amy":{"marks":20}}}');
  assert r->>'status' = 'saved' and r->>'ranked' = 'false', 'bot game: ' || r::text;
  -- someone else's game Amy neither played nor follows: refused
  begin
    perform record_game('{"game_id":"11111111-0000-0000-0000-000000000003","game_type":"x01","players":["Ben","Eve"],"winner":"Eve","stats":{}}');
    raise exception 'saved a stranger''s game';
  exception when insufficient_privilege then null; end;
  -- bad shapes
  begin perform record_game('{"game_id":"x","game_type":"x01","players":["Amy"],"winner":"Amy"}'); raise exception 'bad id accepted';
  exception when invalid_parameter_value then null; end;
  begin perform record_game('{"game_id":"11111111-0000-0000-0000-000000000004","game_type":"poker","players":["Amy"],"winner":"Amy"}'); raise exception 'bad type accepted';
  exception when invalid_parameter_value then null; end;
  begin perform record_game('{"game_id":"11111111-0000-0000-0000-000000000005","game_type":"x01","players":["Amy","Ben"],"winner":"Zed"}'); raise exception 'bad winner accepted';
  exception when invalid_parameter_value then null; end;
  begin perform record_game('{"game_id":"11111111-0000-0000-0000-000000000006","game_type":"x01","players":["Amy","Nobody"],"winner":"Amy"}'); raise exception 'unknown player accepted';
  exception when invalid_parameter_value then null; end;
  -- direct writes are closed
  begin
    insert into game_results (game_id, username, game_type, winner, result) values ('11111111-0000-0000-0000-000000000007', 'Amy', 'x01', 'Amy', 'win');
    raise exception 'direct result insert allowed';
  exception when insufficient_privilege then null; end;
  begin update players set elo = 2000 where username = 'Amy'; raise exception 'direct Elo write allowed';
  exception when insufficient_privilege then null; end;
  begin insert into player_events (kind, day) values ('visit', current_date - 30); raise exception 'back-filled a visit';
  exception when invalid_parameter_value then null; end;
  insert into player_events (kind, day) values ('visit', current_date);
end $$;
reset role;

do $$ begin
  assert (select count(*) from game_results where game_id = '11111111-0000-0000-0000-000000000001') = 2, 'one row each';
  assert (select result from game_results where game_id = '11111111-0000-0000-0000-000000000001' and username = 'Ben') = 'loss', 'Ben lost';
  assert (select opponents from game_results where game_id = '11111111-0000-0000-0000-000000000001' and username = 'Amy') = '["Ben"]'::jsonb, 'opponents';
  assert (select elo from players where username = 'Amy') = 1012, 'Amy rating written';
  assert (select elo from players where username = 'Ben') = 988, 'Ben rating written';
  assert (select result from game_results where game_id = '11111111-0000-0000-0000-000000000002') = 'practice', 'bot game is practice';
  assert (select completed_at from game_results where game_id = '11111111-0000-0000-0000-000000000002') <= now(), 'future date clamped';
end $$;

-- Ben follows Amy and Eve: he may score their game
insert into follows (follower, followed) select 'b1000000-0000-0000-0000-0000000000b1', id from players where username in ('Amy', 'Eve');
set role authenticated;
set request.jwt.claim.sub = 'b1000000-0000-0000-0000-0000000000b1';
do $$
declare r jsonb;
begin
  r := record_game('{"game_id":"11111111-0000-0000-0000-000000000008","game_type":"cricket","players":["Eve","Amy","bot:x"],"winner":"Eve","stats":{}}');
  assert r->>'status' = 'saved', 'scored for friends';
end $$;
reset role;

-- a three-player ranked game: winner against each loser in throw order
set role authenticated;
set request.jwt.claim.sub = 'b1000000-0000-0000-0000-0000000000b1';
do $$
declare r jsonb;
begin
  r := record_game('{"game_id":"11111111-0000-0000-0000-000000000009","game_type":"killer","players":["Ben","Amy","Eve"],"winner":"Eve","stats":{}}');
  assert r->>'ranked' = 'true', 'ranked';
  -- Eve 1000 v Ben 988, then v Amy 1012 (lib/stats.js gives 1024, 976, 1000)
  assert (r->'elo'->>'Eve')::int = 1024 and (r->'elo'->>'Ben')::int = 976 and (r->'elo'->>'Amy')::int = 1000, 'three-way elo: ' || r::text;
end $$;
reset role;
