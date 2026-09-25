-- Live updates: let the app subscribe to changes on these tables through
-- Supabase Realtime (app/app/page.js refreshes when one arrives).
-- Realtime applies each table's existing row-level security to the events
-- it delivers, so no one receives a row they couldn't already select.
-- Safe to re-run.
do $$
declare t text;
begin
  foreach t in array array['game_results', 'follows', 'players'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
