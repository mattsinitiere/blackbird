-- A sixth profile cover, "contours" (lib/covers.js). Widens the allowed
-- cover ids; no rows change. Safe to run more than once.
alter table players drop constraint if exists players_cover_set;
alter table players add constraint players_cover_set
  check (cover is null or cover in ('playon','dartboard','flight','scoreboard','night','contours'));
