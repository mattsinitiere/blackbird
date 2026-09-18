-- ============================================================
-- Player profiles: @handle, bio, location (v1.6)
-- Safe to re-run. Adds nullable columns, backfills a unique handle for
-- every existing player from their name, and guards the profile fields so
-- only the account that owns a player row can edit them.
-- ============================================================

alter table players add column if not exists handle text;
alter table players add column if not exists bio text;
alter table players add column if not exists location text;

-- Backfill: lowercase the name, strip everything but [a-z0-9_], pad to 3,
-- cap at 20, and add a numeric suffix on collision.
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in select id, username from players where handle is null order by created_at loop
    base := regexp_replace(lower(r.username), '[^a-z0-9_]', '', 'g');
    if length(base) < 3 then base := rpad(coalesce(base, ''), 3, '0'); end if;
    base := left(base, 20);
    cand := base;
    n := 1;
    while exists (select 1 from players where lower(handle) = cand) loop
      n := n + 1;
      cand := left(base, 20 - length(n::text)) || n::text;
    end loop;
    update players set handle = cand where id = r.id;
  end loop;
end $$;

create unique index if not exists players_handle_lower_idx on players (lower(handle));

alter table players drop constraint if exists players_handle_format;
alter table players add constraint players_handle_format
  check (handle is null or handle ~ '^[a-z0-9_]{3,20}$');
alter table players drop constraint if exists players_bio_len;
alter table players add constraint players_bio_len
  check (bio is null or length(bio) <= 160);
alter table players drop constraint if exists players_location_len;
alter table players add constraint players_location_len
  check (location is null or length(location) <= 60);

-- Only the owning account may change handle/bio/location. Elo, hidden and
-- color updates by other members keep working (the update policy is
-- unchanged); unclaimed guest rows (auth_id null) stay editable until
-- claimed; the service role (auth.uid() is null) is never blocked.
create or replace function players_guard_profile() returns trigger
language plpgsql as $$
begin
  if (new.handle is distinct from old.handle
      or new.bio is distinct from old.bio
      or new.location is distinct from old.location)
     and old.auth_id is not null
     and auth.uid() is not null
     and old.auth_id <> auth.uid() then
    raise exception 'Only the profile owner can edit handle, bio and location'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists players_guard_profile on players;
create trigger players_guard_profile
  before update on players
  for each row execute function players_guard_profile();
