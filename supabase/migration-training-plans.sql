-- Training plans (lib/trainingPlans.js, app/api/plans/route.js).
-- Additive and safe to run more than once.
--
-- Rules enforced here, not just in the app:
--   * at most THREE saved plans per account: each plan occupies one of
--     three slots, and (auth_id, slot) is unique, so concurrent creates
--     from several tabs or devices cannot exceed three;
--   * creation is idempotent: (auth_id, request_key) is unique, and a
--     retry with the same key returns the plan already made;
--   * a saved plan's definition is immutable: no UPDATE policy exists and
--     a trigger rejects every UPDATE (service role included);
--   * plans are created only through create_training_plan(), callable by
--     the server's service role after it has validated the definition
--     against the drill allowlist; members cannot insert directly;
--   * members can read and delete their own plans; deleting frees the
--     slot and removes that plan's progress rows, never game results.

create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  request_key text not null check (char_length(request_key) between 8 and 80),
  source text not null check (source in ('ai', 'custom')),
  schema_version int not null default 1 check (schema_version >= 1),
  definition jsonb not null
    check (jsonb_typeof(definition) = 'object'
           and jsonb_typeof(definition -> 'sessions') = 'array'
           and jsonb_array_length(definition -> 'sessions') between 1 and 24
           and pg_column_size(definition) <= 16384),
  baseline jsonb check (baseline is null or (jsonb_typeof(baseline) = 'object' and pg_column_size(baseline) <= 8192)),
  created_at timestamptz not null default now(),
  constraint training_plans_slot_uniq unique (auth_id, slot),
  constraint training_plans_request_uniq unique (auth_id, request_key)
);

alter table training_plans enable row level security;
drop policy if exists "plans_select_own" on training_plans;
create policy "plans_select_own" on training_plans
  for select to authenticated using (auth_id = auth.uid());
drop policy if exists "plans_delete_own" on training_plans;
create policy "plans_delete_own" on training_plans
  for delete to authenticated using (auth_id = auth.uid());
-- belt and braces: members can't insert or update even if a policy is added by mistake
revoke insert, update on training_plans from anon, authenticated;

create or replace function training_plans_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Saved training plans cannot be edited. Delete the plan and create a new one.'
    using errcode = '42501';
end $$;
drop trigger if exists training_plans_immutable on training_plans;
create trigger training_plans_immutable
  before update on training_plans
  for each row execute function training_plans_immutable();

-- Create a plan in the lowest free slot. Returns { plan, created }.
-- A retry with the same request key returns the existing plan with
-- created = false. With all three slots taken it raises 'plan_limit'.
create or replace function create_training_plan(
  p_auth_id uuid, p_request_key text, p_source text, p_definition jsonb, p_baseline jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing training_plans;
  made training_plans;
  s int;
begin
  if p_auth_id is null then
    raise exception 'owner required' using errcode = '22004';
  end if;
  -- serialise one account's creates; the unique constraints below are
  -- the actual guarantee, this just avoids needless conflicts
  perform pg_advisory_xact_lock(hashtextextended('training_plans:' || p_auth_id::text, 0));
  select * into existing from training_plans where auth_id = p_auth_id and request_key = p_request_key;
  if found then
    return jsonb_build_object('plan', to_jsonb(existing), 'created', false);
  end if;
  for s in 1..3 loop
    begin
      insert into training_plans (auth_id, slot, request_key, source, definition, baseline)
      values (p_auth_id, s, p_request_key, p_source, p_definition, p_baseline)
      returning * into made;
      return jsonb_build_object('plan', to_jsonb(made), 'created', true);
    exception when unique_violation then
      select * into existing from training_plans where auth_id = p_auth_id and request_key = p_request_key;
      if found then
        return jsonb_build_object('plan', to_jsonb(existing), 'created', false);
      end if;
      -- that slot is taken: try the next one
    end;
  end loop;
  raise exception 'plan_limit' using errcode = 'P0001',
    hint = 'You have reached your limit of 3 training plans. Delete a plan to create another.';
end $$;

revoke all on function create_training_plan(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function create_training_plan(uuid, text, text, jsonb, jsonb) to service_role;

-- Progress: one row per completed item (drill) of a plan session, written
-- once the game is saved. Unique per (plan, session, item) and per game,
-- so a retried save or sync never counts twice.
create table if not exists plan_completions (
  id bigserial primary key,
  plan_id uuid not null references training_plans (id) on delete cascade,
  auth_id uuid not null default auth.uid(),
  session_idx smallint not null check (session_idx >= 0),
  item_idx smallint not null check (item_idx >= 0),
  game_id uuid not null,
  completed_at timestamptz not null default now(),
  constraint plan_completions_item_uniq unique (plan_id, session_idx, item_idx),
  constraint plan_completions_game_uniq unique (plan_id, game_id)
);
create index if not exists plan_completions_owner_idx on plan_completions (auth_id, completed_at);

alter table plan_completions enable row level security;
drop policy if exists "plan_completions_select_own" on plan_completions;
create policy "plan_completions_select_own" on plan_completions
  for select to authenticated using (auth_id = auth.uid());
-- insert only: your own plan, an item that exists in its saved definition,
-- and a game result of your own that is already saved
drop policy if exists "plan_completions_insert_own" on plan_completions;
create policy "plan_completions_insert_own" on plan_completions
  for insert to authenticated with check (
    auth_id = auth.uid()
    and exists (
      select 1 from training_plans p
      where p.id = plan_id
        and p.auth_id = auth.uid()
        and session_idx < jsonb_array_length(p.definition -> 'sessions')
        and item_idx < jsonb_array_length(p.definition -> 'sessions' -> session_idx::int -> 'items')
    )
    and exists (
      select 1 from game_results g
      where g.game_id = plan_completions.game_id
        and g.username in (select pl.username from players pl where pl.auth_id = auth.uid())
    )
  );
revoke update on plan_completions from anon, authenticated;
