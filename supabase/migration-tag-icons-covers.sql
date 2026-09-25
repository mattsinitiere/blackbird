-- More name tag icons + a choice of profile cover.
-- Safe to run more than once. Widens the allowed tag icon ids (no rows
-- change), adds players.cover (null = the default "playon" cover), and
-- extends the owner-only guard so only a profile's owner can change it.

-- 1) tag icons: the 12 originals plus 12 more (lib/profile.js TAG_ICONS)
alter table players drop constraint if exists players_tag_icon_set;
alter table players add constraint players_tag_icon_set
  check (tag_icon is null or tag_icon in (
    'crown','flame','bolt','star','target','skull','bird','clover','diamond','anchor','ghost','rocket',
    'dart','trophy','medal','shield','heart','dice','compass','moon','sun','pint','paw','horseshoe'
  ));

-- 2) profile cover (lib/covers.js COVERS)
alter table players add column if not exists cover text;
alter table players drop constraint if exists players_cover_set;
alter table players add constraint players_cover_set
  check (cover is null or cover in ('playon','dartboard','flight','scoreboard','night'));

-- 3) owner-only edits now also cover the cover
create or replace function players_guard_profile() returns trigger
language plpgsql as $$
begin
  if (new.handle   is distinct from old.handle
      or new.bio      is distinct from old.bio
      or new.location is distinct from old.location
      or new.tag      is distinct from old.tag
      or new.tag_icon is distinct from old.tag_icon
      or new.cover    is distinct from old.cover)
     and old.auth_id is not null
     and auth.uid() is not null
     and old.auth_id <> auth.uid() then
    raise exception 'Only the profile owner can edit handle, bio, location, tag and cover'
      using errcode = '42501';
  end if;
  return new;
end $$;
