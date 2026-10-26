# Database migrations

Run these in the Supabase SQL Editor, in this order. Every file is safe to
run more than once. `npm run test:sql` applies the same list (from
`tests/sql/run.sh`) to a throwaway Postgres and runs the RLS tests, and CI
does it on every pull request, so this order is the tested one.

| # | File | What it does |
|---|------|--------------|
| 1 | `schema.sql` | players and the legacy matches table, base policies |
| 2 | `migration-add-auth-id.sql` | link a player row to a login account |
| 3 | `migration-add-color.sql` | avatar colors |
| 4 | `migration-add-hidden.sql` | hide a player from standings |
| 5 | `migration-per-player.sql` | `game_results`, one row per player per game |
| 6 | `migration-add-profile.sql` | @handles, bio, location; owner-only profile guard |
| 7 | `migration-follows-tags.sql` | follows, name tags, follow-scoped result reads |
| 8 | `migration-tag-icons-covers.sql` | tag icons and profile covers |
| 9 | `migration-contours-cover.sql` | the Contours cover |
| 10 | `migration-dev-tag-icons.sql` | developer-only tag icons |
| 11 | `migration-player-events.sql` | visit / profile activity for achievements |
| 12 | `migration-ai-usage.sql` | the daily AI allowance |
| 13 | `migration-realtime.sql` | live updates (Realtime publication) |
| 14 | `migration-scoped-data.sql` | read indexes; identity guard |
| 15 | `migration-ai-log.sql` | AI request log |
| 16 | `migration-training-plans.sql` | training plans |
| 17 | `migration-search-paths.sql` | pinned search paths on trigger functions |
| 18 | `migration-record-game.sql` | **server-side saves** (`record_game`) and write lockdown |

## `migration-record-game.sql`: deploy the app first

This one closes the old write paths (direct result inserts, direct Elo
writes, editing another account's player row). The app calls
`record_game` and falls back to the old writes only while the function is
missing, so:

1. Deploy the app version that calls `record_game`.
2. Run `migration-record-game.sql`.
3. Check with a test game: the result saves and both players' Elo moves.

A phone still running an older build after step 2 can't save directly any
more; its games wait in that phone's offline queue and sync once it loads
the new version.

Before running it, check for duplicate result rows (the unique
`(game_id, username)` index is skipped while any exist):

```sql
select game_id, username, count(*) from game_results
group by 1, 2 having count(*) > 1;
```

`email-templates/` holds the branded auth emails (see its README).
