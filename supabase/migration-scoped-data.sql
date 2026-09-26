-- Scoped data reads (lib/data/*) and identity hardening.
-- Additive and safe to run more than once. Nothing is deleted and no
-- existing policy is loosened.
--
-- 1) Indexes that match how the app and the AI now read game_results:
--    one player's rows, newest or oldest first, walked in keyset pages by
--    (completed_at, id), optionally narrowed to one game mode.
create index if not exists game_results_user_time_idx
  on game_results (username, completed_at, id);
create index if not exists game_results_user_type_time_idx
  on game_results (username, game_type, completed_at);
-- the keyset walk over everything a user can see (their circle)
create index if not exists game_results_time_id_idx
  on game_results (completed_at, id);

-- 2) Who "me" is. The server now derives the caller's player from
--    players.auth_id = auth.uid(), so a member must not be able to point
--    someone else's row at themselves, or rename a row that belongs to
--    another account. (migration-lock-writes.sql, run last, then limits
--    the players UPDATE policy to the owner or admin.) This trigger closes
--    the identity columns. The service role (admin tools) has no auth.uid()
--    and is unaffected.
create or replace function players_guard_identity() returns trigger
language plpgsql as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return new; -- service role / SQL editor
  end if;
  if tg_op = 'INSERT' then
    if new.auth_id is not null and new.auth_id <> me then
      raise exception 'A player can only be linked to your own account' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.auth_id is distinct from old.auth_id then
    -- claiming an unlinked row for yourself is how accounts get linked;
    -- anything else (stealing, unlinking someone) is refused
    if not (old.auth_id is null and new.auth_id = me) then
      raise exception 'Only the account owner can change who this player is linked to' using errcode = '42501';
    end if;
  end if;
  if new.username is distinct from old.username
     and old.auth_id is not null and old.auth_id <> me then
    raise exception 'Only the account owner can rename this player' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists players_guard_identity on players;
create trigger players_guard_identity
  before insert or update on players
  for each row execute function players_guard_identity();
