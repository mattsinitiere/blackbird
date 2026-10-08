-- migration-lock-writes.sql: members change only their own row, only the
-- admin changes anyone's, and games/Elo are written by the service role.
\set ON_ERROR_STOP 1
-- everything below is rolled back so other test files see a clean database
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'matthews@finishessolutions.com', '{"display_name":"Boss"}'),
  ('20000000-0000-0000-0000-000000000002', 'mem@test', '{"display_name":"Mem"}'),
  ('30000000-0000-0000-0000-000000000003', 'new@test', '{"display_name":"Newbie"}');
insert into players (username, auth_id, elo) values
  ('Boss', '10000000-0000-0000-0000-000000000001', 1000),
  ('Mem', '20000000-0000-0000-0000-000000000002', 1000),
  ('Steve', null, 1000),
  ('Newbie', null, 1000);

-- a member (not the admin)
set role authenticated;
set request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
do $$
declare n int;
begin
  -- others' rows: the update policy hides them (0 rows), whatever the column
  update players set elo = 3000 where username = 'Boss';
  get diagnostics n = row_count;
  assert n = 0, 'changed another player''s Elo';
  update players set hidden = true, color = '#000000' where username = 'Boss';
  get diagnostics n = row_count;
  assert n = 0, 'changed another player''s visibility';
  update players set auth_id = '20000000-0000-0000-0000-000000000002' where username = 'Boss';
  get diagnostics n = row_count;
  assert n = 0, 'took over another profile';

  -- own row: Elo and name are admin/server-only
  begin update players set elo = 3000 where username = 'Mem'; raise exception 'changed own Elo';
  exception when insufficient_privilege then null; end;
  begin update players set username = 'Memo' where username = 'Mem'; raise exception 'renamed own row';
  exception when insufficient_privilege then null; end;

  -- guests (unclaimed): no Elo, no claiming under another name
  begin update players set elo = 3000 where username = 'Steve'; raise exception 'changed a guest''s Elo';
  exception when insufficient_privilege then null; end;
  begin update players set auth_id = '20000000-0000-0000-0000-000000000002' where username = 'Steve'; raise exception 'claimed a guest under another name';
  exception when insufficient_privilege then null; end;

  -- results and matches: no browser inserts
  begin
    insert into game_results (game_id, username, game_type, winner, result, elo_after)
      values (gen_random_uuid(), 'Mem', 'x01', 'Mem', 'win', 2000);
    raise exception 'inserted a game result';
  exception when insufficient_privilege then null; end;
  begin
    insert into matches (game_type, players, winner, per_player)
      values ('x01', '["Mem","Boss"]', 'Mem', '{}');
    raise exception 'inserted a match';
  exception when insufficient_privilege then null; end;

  -- one player row per account
  begin insert into players (username, auth_id) values ('Mem2', '20000000-0000-0000-0000-000000000002'); raise exception 'added a second row for the same account';
  exception when insufficient_privilege then null; end;

  -- still allowed: own colour and visibility; adding a guest (Elo pinned)
  update players set color = '#123456', hidden = false where username = 'Mem';
  get diagnostics n = row_count;
  assert n = 1, 'could not change own colour';
  insert into players (username, elo) values ('Rookie', 5000);
end $$;
reset role;

do $$ begin
  assert (select elo from players where username = 'Rookie') = 1000, 'guest Elo not pinned to 1000';
  assert (select elo from players where username = 'Boss') = 1000, 'Boss Elo changed';
  assert (select color from players where username = 'Mem') = '#123456', 'own colour not saved';
  assert (select auth_id from players where username = 'Steve') is null, 'Steve was claimed';
end $$;

-- a new account with no row claims the guest carrying its display name
set role authenticated;
set request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
do $$ begin
  update players set auth_id = '30000000-0000-0000-0000-000000000003' where username = 'Newbie';
  -- ...but only one row per account
  begin update players set auth_id = '30000000-0000-0000-0000-000000000003' where username = 'Steve'; raise exception 'claimed a second row';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert (select auth_id from players where username = 'Newbie') = '30000000-0000-0000-0000-000000000003', 'claim by own name failed';
end $$;

-- the admin, signed in, can change anyone
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
do $$
declare n int;
begin
  update players set elo = 1234, hidden = true where username = 'Mem';
  get diagnostics n = row_count;
  assert n = 1, 'admin could not update another player';
  update players set elo = 1111 where username = 'Steve';
  insert into players (username, elo) values ('AdminGuest', 1200);
end $$;
reset role;
do $$ begin
  assert (select elo from players where username = 'Mem') = 1234, 'admin Elo edit lost';
  assert (select elo from players where username = 'AdminGuest') = 1200, 'admin insert Elo overridden';
end $$;

-- the server (service role) saves a game and writes Elo
set role service_role;
insert into game_results (game_id, username, game_type, winner, result, opponents, elo_after)
  values ('5a000000-0000-0000-0000-000000000001', 'Mem', 'x01', 'Mem', 'win', '["Boss"]', 1250),
         ('5a000000-0000-0000-0000-000000000001', 'Boss', 'x01', 'Mem', 'loss', '["Mem"]', 984);
update players set elo = 1250 where username = 'Mem';
update players set elo = 984 where username = 'Boss';
reset role;
do $$ begin
  assert (select elo from players where username = 'Mem') = 1250, 'service role Elo write failed';
end $$;

-- a plan game saved by the server still counts toward the member's plan
set role service_role;
do $$
declare r jsonb;
begin
  r := create_training_plan('20000000-0000-0000-0000-000000000002', 'mem-lock-writes-1', 'custom',
    '{"title":"T","sessions":[{"items":[{"type":"x01"}]}]}'::jsonb, null);
  perform set_config('bb.plan', r->'plan'->>'id', true);
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
do $$ begin
  insert into plan_completions (plan_id, session_idx, item_idx, game_id)
    values (current_setting('bb.plan')::uuid, 0, 0, '5a000000-0000-0000-0000-000000000001');
  assert (select count(*) from plan_completions) = 1, 'plan completion not recorded';
end $$;
reset role;

rollback;
