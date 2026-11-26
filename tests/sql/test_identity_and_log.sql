-- players identity guard, ai_request_log ownership, game_results visibility.
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-00000000000c', 'cat@test'),
  ('d0000000-0000-0000-0000-00000000000d', 'dan@test');
insert into players (username, auth_id) values ('Cat', 'c0000000-0000-0000-0000-00000000000c'), ('Dan', 'd0000000-0000-0000-0000-00000000000d'), ('Unlinked', null);
insert into game_results (game_id, username, game_type, winner, result) values
  ('0c000000-0000-0000-0000-000000000001', 'Cat', 'x01', 'Cat', 'practice'),
  ('0d000000-0000-0000-0000-000000000001', 'Dan', 'x01', 'Dan', 'practice');

set role authenticated;
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$ begin
  -- can't point Dan's row at yourself, unlink it, or rename it: RLS hides
  -- another account's row from updates, so each of these changes nothing
  update players set auth_id = 'c0000000-0000-0000-0000-00000000000c' where username = 'Dan';
  update players set auth_id = null where username = 'Dan';
  update players set username = 'Danny' where username = 'Dan';
  assert (select count(*) from players where username = 'Dan' and auth_id = 'd0000000-0000-0000-0000-00000000000d') = 1, 'Dan''s row unchanged';
  begin insert into players (username, auth_id) values ('Fake', 'd0000000-0000-0000-0000-00000000000d'); raise exception 'inserted a row linked to someone else';
  exception when insufficient_privilege then null; end;
  -- Elo moves only through record_game (migration-record-game.sql), and a
  -- row linked to another account can't be edited at all
  begin update players set elo = 990 where username = 'Cat'; raise exception 'wrote Elo directly';
  exception when insufficient_privilege then null; end;
  update players set hidden = true where username = 'Dan';
  assert not (select hidden from players where username = 'Dan'), 'hid another account''s player';
  -- still allowed: editing your own row, claiming an unlinked row, adding an unlinked guest
  update players set color = '#123456' where username = 'Cat';
  insert into players (username) values ('Guest');
  -- results: only your own (no follows here)
  assert (select count(*) from game_results) = 1, 'Cat sees only her own results';
  -- the log stamps the caller, whatever they claim
  perform ai_log_request('chat', 'gpt-6-luna', 'none', 100, 20, 1, 2, 1500, 'ok', null, 'tools');
  assert (select count(*) from ai_request_log) = 1, 'own log row visible';
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$ begin
  update players set auth_id = 'c0000000-0000-0000-0000-00000000000c' where username = 'Unlinked';
end $$;
reset role;
do $$ begin
  assert (select auth_id from players where username = 'Unlinked') = 'c0000000-0000-0000-0000-00000000000c', 'claimed the unlinked row';
  assert (select auth_id from players where username = 'Dan') = 'd0000000-0000-0000-0000-00000000000d', 'Dan still Dan';
  assert (select auth_id from ai_request_log limit 1) = 'c0000000-0000-0000-0000-00000000000c', 'log row owned by the caller';
end $$;

set role authenticated;
set request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';
do $$ begin
  assert (select count(*) from ai_request_log) = 0, 'Dan cannot read Cat''s log';
  begin insert into ai_request_log (auth_id, kind, status) values ('c0000000-0000-0000-0000-00000000000c', 'chat', 'ok'); raise exception 'direct log insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role anon;
do $$ begin
  begin perform ai_log_request('chat', null, null, null, null, 0, 0, 0, 'ok', null, null); raise exception 'anon logged';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- the admin (service role) can still rename and relink
set role service_role;
update players set username = 'Daniel' where username = 'Dan';
reset role;
