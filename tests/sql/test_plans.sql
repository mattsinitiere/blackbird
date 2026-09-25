-- Training plans: three-plan limit, idempotency, immutability, isolation,
-- progress rules and deletion. Runs as superuser for fixtures and switches
-- to the member / service roles for each check.
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'ann@test'),
  ('b0000000-0000-0000-0000-00000000000b', 'bob@test');
insert into players (username, auth_id) values ('Ann', 'a0000000-0000-0000-0000-00000000000a'), ('Bob', 'b0000000-0000-0000-0000-00000000000b');
insert into game_results (game_id, username, game_type, winner, result) values
  ('0a000000-0000-0000-0000-000000000001', 'Ann', 'checkoutDrill', 'Ann', 'practice'),
  ('0a000000-0000-0000-0000-000000000002', 'Ann', 'bobs27', 'Ann', 'practice'),
  ('0b000000-0000-0000-0000-000000000001', 'Bob', 'bobs27', 'Bob', 'practice');

create temp table ids (k text primary key, id uuid);
grant all on ids to public;

-- a two-session plan: session 0 has two items, session 1 has one
create temp table defs (v jsonb);
insert into defs values ('{"title":"T","sessions":[{"items":[{"type":"checkoutDrill"},{"type":"bobs27"}]},{"items":[{"type":"bobs27"}]}]}');
grant all on defs to public;

-- 1) three creates fill slots 1..3; a fourth is refused
set role service_role;
do $$
declare r jsonb; s int;
begin
  for s in 1..3 loop
    r := create_training_plan('a0000000-0000-0000-0000-00000000000a', 'ann-request-' || s, 'custom', (select v from defs), null);
    assert (r->>'created')::boolean, 'plan should be created';
    assert (r->'plan'->>'slot')::int = s, 'lowest free slot';
    insert into ids values ('ann' || s, (r->'plan'->>'id')::uuid);
  end loop;
  begin
    perform create_training_plan('a0000000-0000-0000-0000-00000000000a', 'ann-request-4', 'ai', (select v from defs), null);
    raise exception 'fourth plan was allowed';
  exception when others then
    assert sqlerrm = 'plan_limit', 'expected plan_limit, got ' || sqlerrm;
  end;
  -- 2) a retry with an existing key returns that plan, creates nothing
  r := create_training_plan('a0000000-0000-0000-0000-00000000000a', 'ann-request-2', 'custom', (select v from defs), null);
  assert not (r->>'created')::boolean, 'retry must not create';
  assert (select count(*) from training_plans where auth_id = 'a0000000-0000-0000-0000-00000000000a') = 3, 'still three';
  -- 3) even the service role cannot edit a saved definition
  begin
    update training_plans set definition = '{"sessions":[{"items":[]}]}' where id = (select id from ids where k = 'ann1');
    raise exception 'update was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4) members: cannot call the creator, insert, or update; see only their own
set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    perform create_training_plan('b0000000-0000-0000-0000-00000000000b', 'bob-request-1', 'custom', '{"sessions":[{"items":[{}]}]}'::jsonb, null);
    raise exception 'member called create_training_plan';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into training_plans (auth_id, slot, request_key, source, definition) values ('b0000000-0000-0000-0000-00000000000b', 1, 'bob-direct-1', 'custom', '{"sessions":[{"items":[{}]}]}');
    raise exception 'member inserted a plan directly';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from training_plans) = 0, 'Bob sees none of Ann''s plans';
  delete from training_plans where id = (select id from ids where k = 'ann1');
end $$;
reset role;
do $$ begin assert (select count(*) from training_plans) = 3, 'Bob could not delete Ann''s plan'; end $$;

set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from training_plans) = 3, 'Ann sees her three';
  begin
    update training_plans set source = 'ai' where id = (select id from ids where k = 'ann1');
    raise exception 'member updated a plan';
  exception when insufficient_privilege then null;
  end;
  -- 5) progress: a valid completion is recorded once
  insert into plan_completions (plan_id, session_idx, item_idx, game_id)
    values ((select id from ids where k = 'ann1'), 0, 0, '0a000000-0000-0000-0000-000000000001');
  begin
    insert into plan_completions (plan_id, session_idx, item_idx, game_id)
      values ((select id from ids where k = 'ann1'), 0, 0, '0a000000-0000-0000-0000-000000000002');
    raise exception 'same item completed twice';
  exception when unique_violation then null;
  end;
  -- an item that isn't in the saved definition
  begin
    insert into plan_completions (plan_id, session_idx, item_idx, game_id)
      values ((select id from ids where k = 'ann1'), 1, 1, '0a000000-0000-0000-0000-000000000002');
    raise exception 'out-of-range item accepted';
  exception when insufficient_privilege then null;
  end;
  -- someone else's game
  begin
    insert into plan_completions (plan_id, session_idx, item_idx, game_id)
      values ((select id from ids where k = 'ann1'), 0, 1, '0b000000-0000-0000-0000-000000000001');
    raise exception 'another player''s game accepted';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from plan_completions) = 1, 'one completion';
end $$;
reset role;

-- Bob can't record progress on Ann's plan
set role authenticated;
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ begin
  begin
    insert into plan_completions (plan_id, session_idx, item_idx, game_id)
      values ((select id from ids where k = 'ann1'), 0, 1, '0b000000-0000-0000-0000-000000000001');
    raise exception 'Bob wrote progress on Ann''s plan';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from plan_completions) = 0, 'Bob sees no progress rows of Ann';
end $$;
reset role;

-- 6) deleting frees a slot, removes progress, keeps the game results
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  delete from training_plans where id = (select id from ids where k = 'ann1');
  assert (select count(*) from training_plans) = 2, 'deleted';
end $$;
reset role;
do $$
declare r jsonb;
begin
  assert (select count(*) from plan_completions) = 0, 'progress removed with the plan';
  assert (select count(*) from game_results where username = 'Ann') = 2, 'game results untouched';
  set local role service_role;
  r := create_training_plan('a0000000-0000-0000-0000-00000000000a', 'ann-request-5', 'ai', '{"sessions":[{"items":[{}]}]}'::jsonb, '{"x":1}'::jsonb);
  assert (r->>'created')::boolean and (r->'plan'->>'slot')::int = 1, 'the freed slot is reused';
end $$;
