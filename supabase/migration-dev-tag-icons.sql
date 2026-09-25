-- Developer-only gold tag icons (lib/profile.js DEV_TAG_ICONS).
-- Everyone can SEE them on the developer's tag; only the developer's own
-- player row can SET them. Safe to run more than once.

-- 1) allow the three new ids
alter table players drop constraint if exists players_tag_icon_set;
alter table players add constraint players_tag_icon_set
  check (tag_icon is null or tag_icon in (
    'crown','flame','bolt','star','target','skull','bird','clover','diamond','anchor','ghost','rocket',
    'dart','trophy','medal','shield','heart','dice','compass','moon','sun','pint','paw','horseshoe',
    'devCrown','devCode','devTerminal'
  ));

-- 2) a dev icon may only be set on the row linked to the developer's
--    account (lib/constants.js ADMIN_EMAIL). security definer so it can
--    look up the email in auth.users; it reads nothing else. The change
--    must also be made by the developer's own session.
create or replace function players_guard_dev_icon() returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.tag_icon in ('devCrown','devCode','devTerminal')
     and (tg_op = 'INSERT' or new.tag_icon is distinct from old.tag_icon)
     and (
       not exists (
         select 1 from auth.users u
         where u.id = new.auth_id
           and lower(u.email) = 'matthews@finishessolutions.com'
       )
       -- and the change must come from the developer's own session
       -- (auth.uid() is null only for the dashboard / service role)
       or (auth.uid() is not null and auth.uid() is distinct from new.auth_id)
     ) then
    raise exception 'That tag icon is reserved for the developer'
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function players_guard_dev_icon() from public, anon, authenticated;

drop trigger if exists players_guard_dev_icon on players;
create trigger players_guard_dev_icon
  before insert or update on players
  for each row execute function players_guard_dev_icon();
