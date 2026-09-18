# Blackbird Dart Scoring System

Blackbird is a mobile-first web app for scoring darts with your league or
friends. It scores **X01 (501 / 301 / 701, single leg or best-of)**,
**Cricket** (Standard, Cutthroat, and No-score), **Baseball**, **Around the
Clock**, **Killer**, **Shanghai**, **Halve It**, **Gotcha**, and
**Tic-Tac-Toe**, keeps every player's stats in a shared Postgres database,
and layers on leaderboards, an end-of-game summary (mirrored on the TV),
player profiles with trend charts, and an **Elo matchup predictor**. On
your own you can run **practice drills** (Bob's 27, checkouts, scoring) or
climb a ladder of eight **bot opponents** that throw for themselves; all
of that lands in a personal practice log, never in the league stats.

Everyone signs in with email/password, scores games on their phone, and the
stats sync instantly for the whole group. No game data is kept in
localStorage — Postgres is the single source of truth.

## Screenshots

*(Captured on a phone-sized viewport with demo data.)*

| Loading screen | Loading (dark) | Home |
|:---:|:---:|:---:|
| <img src="docs/screenshots/loading-light.png" width="240" alt="Blackbird splash: wordmark with spinning dartboard wheel, light theme"> | <img src="docs/screenshots/loading-dark.png" width="240" alt="Blackbird splash: wordmark with spinning dartboard wheel, dark theme"> | <img src="docs/screenshots/home.png" width="240" alt="Home view with quick stats, games-per-week chart, and top players"> |

| Live cricket (MPR column) | Cricket leaderboard | Game setup |
|:---:|:---:|:---:|
| <img src="docs/screenshots/cricket-live-mpr.png" width="240" alt="Cricket scoring screen with live MPR per player and round number"> | <img src="docs/screenshots/leaderboard-cricket.png" width="240" alt="Standings sorted by cricket MPR"> | <img src="docs/screenshots/setup.png" width="240" alt="New game setup with cricket variants and player picker"> |

| MPR over time | Cricket profile card | Phone while casting |
|:---:|:---:|:---:|
| <img src="docs/screenshots/profile-mpr-chart.png" width="240" alt="Profile trend charts including cricket MPR over time"> | <img src="docs/screenshots/profile-cricket.png" width="240" alt="Profile cricket card with career MPR, best MPR, and marks by round"> | <img src="docs/screenshots/phone-casting.png" width="240" alt="Simplified phone scoring UI while casting, showing the TV code"> |

**TV scoreboard** (`/tv`, paired with the phone by a 4-character code):

<img src="docs/screenshots/tv-cricket.png" width="740" alt="TV scoreboard showing a live cricket game with marks, points, MPR and whose throw it is">

<img src="docs/screenshots/tv-x01.png" width="740" alt="TV scoreboard showing a live 501 game with giant remaining scores">

## What it is (at a glance)

- **Profiles and @handles**: every player has a unique `@handle` chosen at
  sign-up (or from the Account page), a bio and a home bar/town, shown on
  their profile and stat card. Only the owning account can edit them.
- **Player avatars and colors**: every player gets a colored circle badge
  with their initial letter, shown next to their name throughout the app.
  Colors are deterministic by default (a hash of the username) and can be
  customized in Account settings. The header shows the signed-in user's
  badge instead of a generic icon.
- **TV scoreboard (cast mode)**: tap Cast to TV during any game, put the
  app's `/tv` page on a TV (AirPlay a Safari window, a smart TV browser, or
  a Chromecast tab-cast), enter the 4-character code, and the TV shows a
  huge live scoreboard while the phone switches to a simplified entry-only
  UI.
- **Responsive**: one codebase, three screen classes — phones (primary),
  tablets/desktop (wider layout, two-column charts), and TVs (`/tv`).
- **Launch splash**: every open starts with the Blackbird wordmark and a
  spinning mini dartboard as the loading wheel — a simple 8-section board
  drawn in one color per theme — held for 1–3 seconds. Seasonal touches:
  confetti and a party hat on the wordmark every September 11, falling
  snow all December (preview any day with `?occasion=birthday|snow`).
- **Games**: X01 with optional double-out and best-of legs, Cricket (3
  variants), Baseball (9 innings + extra innings on ties), Around the
  Clock, Killer, Shanghai, Halve It, Gotcha, and Tic-Tac-Toe.
- **Practice**: solo games, three drills (Bob's 27; a checkout drill of
  random 41–170 finishes with the out-chart shown; a scoring drill at one
  number) and **bots** for X01, Cricket and Baseball. Eight bots, Rook
  (32 average) to Blackbird (100), throw one dart every 0.75 s through a
  real-geometry simulator, so the weak ones spray into 1 and 5 and the
  strong ones find trebles and doubles. Beat a bot to unlock the next. A
  **Practice hub** (Home → Practice & Bots) has the ladder, drill
  launchers, sessions per week, personal bests and trend charts. Practice
  never touches stats, Elo or the standings.
- **Game summary**: every finished game lands on a summary screen — the
  winner with their Elo before/after, ranked player cards with that game's
  key numbers (3-dart average, MPR, runs, lives…), highlights (highest
  turn, checkout, best MPR…), and **Rematch** / New Game / View Standings.
  The summary appears the instant the last dart lands; the result saves in
  the background with a visible saving/saved/failed status and a Retry
  button. When casting, the TV shows the same summary large.
- **Safe scoring**: the multiplier snaps back to Single after every dart,
  Undo sits on its own row under the keypad, and Quit asks before
  discarding a game in progress.
- **Cricket MPR**: live **marks-per-round** for every player while the game is
  being played, per-round mark history saved with each game, career MPR and
  best-game MPR on profiles, and an MPR-over-time chart.
- **Home dashboard**: player/game/top-average tiles, a bar chart of games
  played per week over the last 3 months, a **podium/list leaderboard**
  with a toggle between views (podium shows the top 3 on a visual podium),
  and a **Highlights** section showing records from the last 3 months (most
  active player, most wins, best 3-dart average, highest turn, best
  checkout, best cricket MPR).
- **Stats**: win %, 3-dart average (overall and per dart position), highest
  turn, best leg, highest checkout, MPR, average runs, and more.
- **Elo**: every multi-player game updates a shared Elo rating; the Matchup tab
  predicts win probability between any two players.
- **Player card export**: a canvas-rendered PNG stat card with player avatar,
  Elo, record, and key stats — auto-downloads on desktop and opens the
  share sheet on mobile.
- **Admin panel**: the configured admin account can manage login accounts,
  rename players, set or change anyone's @handle, hide/delete players,
  reset scores, and try experimental full-app skins
  (theme lab — applies only to the admin's own account).
- **Smooth animations**: buttons, cards, and navigation have spring-like
  transitions with press feedback across the entire UI.

## System architecture

*(Deep dive: [ARCHITECTURE.md](ARCHITECTURE.md) documents the whole system
— boot sequence, data model, game-engine contract, TV cast protocol,
theming, security — end to end.)*

```
┌─────────────────────────────┐
│  Phones / browsers (PWA-ish) │  add-to-home-screen web app
└──────────────┬──────────────┘
               │ HTTPS
┌──────────────▼──────────────┐
│  Vercel — Next.js 14         │
│  (App Router, mostly client) │
│                              │
│  app/page.js  ── the whole   │
│    single-page app: auth     │
│    gate, views, live games   │
│                              │
│  app/api/insights/route.js   │  server-only: holds the AI key,
│    → OpenAI/Gemini/Groq/     │  verifies the caller's Supabase
│      Anthropic               │  session before spending quota
│                              │
│  app/api/admin/route.js      │  server-only: holds the Supabase
│    → Supabase service role   │  service_role key; only the
│                              │  ADMIN_EMAIL account may call it
└──────────────┬──────────────┘
               │ supabase-js (anon key + RLS)
┌──────────────▼──────────────┐
│  Supabase                    │
│  • Auth (email/password)     │
│  • Postgres: players,        │
│    game_results, matches     │
│    (legacy), RLS policies    │
└─────────────────────────────┘
```

Key design points:

- **The app is client-rendered.** `app/page.js` is one client component that
  swaps between views (Home, Setup, live game screens, Game Summary,
  Leaderboard, Profile, Matchup, Account, Admin). Live game state lives in React state and
  is checkpointed in-memory so you can navigate away and resume.
- **Scoring math runs in the browser.** When a game finishes, one row per
  player is written to `game_results` with that player's full game stats as
  JSONB, and each player's new Elo is written back to `players`.
- **Aggregation happens at read time.** `lib/stats.js` recomputes career
  stats, timelines, and head-to-head records from the raw `game_results` rows
  on every load — there are no denormalized aggregate tables to migrate.
- **Two server routes exist only to protect secrets**: the AI key
  (`/api/insights`, kept for the retired AI chat tab) and the Supabase
  service-role key (`/api/admin`). Both verify the caller's Supabase session
  token first.

## How the app works

1. **Open the app** — a branded splash (the Blackbird wordmark with a
   spinning mini dartboard as the loading wheel) shows for 1–3 seconds on
   every launch while auth and data load behind it.
2. **Sign in** (Supabase email/password). Your display name is auto-added to
   the shared `players` list so everyone can pick you as an opponent.
3. **Setup** a game: pick the game type and options (start score, double-out
   and legs for X01, variant for Cricket, and so on), pick 1+ players, and
   drag to set the throw order.
4. **Cast to a TV (optional)** — tap **Cast to TV** on the live screen to
   get a 4-character code, open the app's `/tv` page on the TV (smart TV
   browser, AirPlayed Safari window, or Chromecast tab-cast) and enter the
   code. The TV renders the full scoreboard huge — live marks/points/MPR
   for cricket, giant remaining scores for X01, the box score for
   baseball, whose throw it is, and the darts of the current turn — and
   the phone collapses to a simplified entry-only UI. Multiple TVs can
   join the same code; the code stays active across games, and tapping
   Stop on the phone sends every TV back to its code-entry screen. A
   hide/show board toggle on the TV switches between the scoreboard-
   plus-dartboard layout and a score-only view with extra-large numbers
   (remembered per TV). Sync runs over Supabase Realtime broadcast (no login needed on
   the TV, nothing written to the database).
5. **Score the game** on the live screen. Cricket shows the classic marks
   grid, points, a **live MPR column**, and the current **round number**;
   there's full undo (per dart and per turn) and a dartboard heat view of the
   turn. Solo games are practice: saved to your practice log on the profile,
   never counted in stats, Elo or the leaderboard.
6. **Finish** — the winner is detected automatically and the **game
   summary** opens right away: winner, Elo before → after, ranked player
   cards with the key numbers for that game, and highlights. Elo is
   updated pairwise (winner vs each loser) and a `game_results` row is
   inserted per player while you look at the summary; if the save fails
   you get a Retry button and nothing is lost. Any TV that is casting
   switches to the same summary. **Rematch** starts the same game again
   (Killer redraws numbers).
7. **Browse stats** — Leaderboard (sortable by Elo/X01/Cricket MPR), Profiles
   (trend charts + per-game history), Matchup (Elo win probability +
   head-to-head), and your Player Card.

### Cricket MPR details

- **Standard (league-style) mark counting**: darts that advance closing a
  number always count; extra hits past a close count only while at least one
  opponent still has that number open (i.e., while they can score). **Dead
  darts** — thrown at a number everyone has closed, or surplus hits in the
  No-score variant — count **0 marks**. This matches how league/DartConnect
  MPR is computed.
- **Live MPR** = effective marks ÷ completed rounds, shown per player in the
  scoring table and updated at the end of every turn.
- **Per-round history**: each finished game stores `roundMarks` (an array of
  marks scored in each round) plus the final game `mpr` in the player's stats
  JSONB. Profiles show the round-by-round marks of your most recent cricket
  game.
- **Averages**: career MPR is total marks ÷ total rounds across all cricket
  games (a properly weighted average); profiles also show **best single-game
  MPR** and an **MPR-over-time** chart (one point per cricket game — this
  works retroactively for games recorded before per-round tracking existed).

## Data model (Supabase / Postgres)

Run `supabase/schema.sql` once in the Supabase SQL editor. Three tables:

- **`players`** — one row per dart player (a name, not a login):
  `username` (unique display name), `handle` (unique `@handle`, 3–20 chars
  of `a-z 0-9 _`), `bio`, `location`, `hidden` (kept out of standings),
  `color` (optional hex color for their avatar badge), `elo` (current
  rating), `auth_id` (the login account that owns the row, once claimed),
  `created_at`. A trigger lets only the owning account edit `handle`,
  `bio` and `location`.
- **`game_results`** — one row **per player per finished game**: `game_id`
  (shared by all rows of one game), `username`, `game_type`
  (`x01` | `cricket` | `baseball`), `config`, `winner`, `result`
  (`win`/`loss`), `opponents`, `elo_after`, `completed_at`, and `stats` —
  a JSONB blob of that player's performance.
- **`matches`** — legacy one-row-per-game table kept for the admin "rebuild
  from old games" migration; new games do not write to it.

The `stats` JSONB per game type:

| Game | Fields |
|------|--------|
| x01 | `dartsThrown`, `pointsScored`, `highestTurn`, `checkout`, `finalScore`, `legsWon` (best-of only), `darts` (full dart log), `dartPos` (per-dart-position sums) |
| cricket | `marks`, `rounds`, `roundMarks[]` (marks each round), `mpr`, `pointsScored`, `darts` (full dart log) |
| baseball | `runs`, `darts` |
| aroundTheClock | `dartsThrown`, `targetsHit`, `darts` |
| killer | `dartsThrown`, `livesRemaining`, `isKiller`, `darts` |
| shanghai | `totalScore`, `roundScores[]`, `dartsThrown`, `shanghai`, `darts` |
| halveit | `finalScore`, `halves`, `dartsThrown`, `darts` |
| gotcha | `finalScore`, `resetsDealt`, `resetsReceived`, `dartsThrown`, `darts` |
| tictactoe | `squaresClaimed`, `dartsThrown`, `darts` |
| bobs27 | `finalScore`, `doublesHit`, `roundsCompleted`, `busted`, `dartsThrown`, `darts` |
| checkoutDrill | `finishes`, `hit`, `dartsPerHit`, `highestCheckout`, `results[]` (target, darts, hit), `dartsThrown`, `darts` |
| scoringDrill | `total`, `turns`, `avgPerTurn`, `trebles`, `onTarget`, `hitRate`, `bestVisit`, `visits[]`, `dartsThrown`, `darts` |

`result` is `'win'` or `'loss'` for ranked games (two or more people, no
bot, not a drill) and **`'practice'`** for everything else: solo games,
games against a bot and drills. Practice rows keep the player's Elo
unchanged in `elo_after`, name the bot in `opponents` (`bot:rook` …) and
`config.bot`, and are split off before any stats, standings or Elo code
sees them. Bots never get a row of their own.

`lib/summary.js` turns these same fields into the end-of-game summary, so a
new game type only needs a `describe` case there to get a summary screen
and a TV summary for free.

Because `stats` is JSONB, adding new per-game fields (like `roundMarks`)
requires **no SQL migration** — old rows simply lack the new keys and the
stats code tolerates that.

**Row Level Security**: any authenticated user in your Supabase project can
read and insert players/results (and update players for Elo writes). Nobody
can delete or rewrite history through the anon key; destructive actions go
through the admin route with the service-role key.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key (public by design; RLS protects data) |
| `AI_PROVIDER` | server | `openai` (default), `gemini`, `groq`, or `anthropic` — only used by the retired `/api/insights` route |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | server | key for the chosen provider |
| `AI_MODEL` | server | optional model override |
| `SUPABASE_SERVICE_ROLE_KEY` | server | required only for the Admin panel |
| `ADMIN_EMAIL` | server | account allowed to use the Admin panel |

Server-side variables have no `NEXT_PUBLIC_` prefix, so they never reach the
browser.

# Deploy, start to finish

## 1. Code → GitHub
Push this repo to GitHub. Every later `git push` to `main` redeploys Vercel.

## 2. Supabase (database + login)
1. https://supabase.com → **New project** (set + save a DB password).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. Run `supabase/migration-add-color.sql`, `migration-add-auth-id.sql` and
   `migration-add-profile.sql` (player colors, account links, @handles).
4. **Settings → API** → copy **Project URL** and the **anon public** key.
5. **Authentication → Providers → Email**: enabled. Turn **OFF** "Confirm
   email" so accounts work instantly on phones.
6. After everyone has signed up, turn **OFF** "Allow new users to sign up" to
   lock it to your group.

## 3. Pick an AI provider (optional)

The AI chat tab has been retired from the UI, but the `/api/insights`
route is still deployed. Skip this step unless you plan to bring it back.

| Provider | Cost | Get a key | Default model |
|----------|------|-----------|---------------|
| **OpenAI** | Paid | https://platform.openai.com/api-keys | `gpt-4o-mini` |
| **Gemini** | Free | https://aistudio.google.com/apikey | `gemini-2.5-flash` |
| **Groq** | Free | https://console.groq.com/keys | `llama-3.3-70b-versatile` |
| **Anthropic** | Paid | https://console.anthropic.com | `claude-3-5-haiku-latest` |

Model names drift; if a default ever errors, set `AI_MODEL` to a current one.

## 4. Run locally (optional)
```bash
cp .env.example .env.local   # fill in Supabase values + AI_PROVIDER + the key
npm install
npm run dev                  # http://localhost:3000
npm test                     # scoring-core + parser + conformance suite
```

## 5. Deploy to Vercel
1. https://vercel.com → **Add New → Project** → import your repo.
2. Add the environment variables from the table above (Settings →
   Environment Variables). `SUPABASE_SERVICE_ROLE_KEY` is only needed if you
   use the Admin panel.
3. **Deploy.** You get `https://….vercel.app`. Every `git push` redeploys.
4. Supabase → **Authentication → URL Configuration** → set **Site URL** to
   your Vercel URL (only needed if you left email confirmation on).

## 6. On phones
Open the Vercel URL, sign in. iPhone Safari → Share → **Add to Home Screen**;
Android Chrome → menu → **Add to home screen**. Data syncs via Supabase; the
app refreshes every time it regains focus.

## Security notes

- The **Supabase anon key** is meant to be public; the RLS policies in
  `schema.sql` are what protect your data.
- The **service_role key** bypasses RLS. It is used only by
  `app/api/admin/route.js`, which independently verifies the caller is signed
  in **and** is `ADMIN_EMAIL` before doing anything. Keep it server-side only.
- The **AI key** stays on the server; `/api/insights` verifies a valid login
  before calling the model, so a stranger can't burn your quota.

## Known limitations (by design)

- X01 double-out is trusted, not verified (you enter darts per turn).
- Best-of legs are X01 only.
- Multiplayer Elo updates the winner pairwise; losers aren't ranked vs each
  other.
- Cricket games recorded before v1.2 have game totals (`marks`, `rounds`) but
  no per-round breakdown, and their MPR was counted under the old
  every-hit-counts rule.
- AI insights reflect only the stats in your database; with few games they're
  thin.

## Project structure
```
app/
  layout.js               root layout + metadata
  page.js                 the whole app: auth gate, views, live-game state
  globals.css             design system (themes, cards, cricket table, nav)
  api/insights/route.js   server-side AI call (secret key lives here)
  api/admin/route.js      admin actions via Supabase service role
  tv/page.js              TV scoreboard: code entry + live big-screen views
components/
  Auth.js                 sign in / sign up
  Home.js                 landing view: podium/list leaderboard + highlights
  Setup.js                game type, options, player picker (drag to reorder)
  PlayX01.js              X01 scorer (per-dart entry, checkout tracking, legs)
  PlayCricket.js          cricket scorer (marks grid, live MPR, per-round log)
  PlayBaseball.js         baseball scorer (9 innings + extras)
  PlayAroundTheClock.js   / PlayKiller.js / PlayShanghai.js / PlayHalveIt.js
  PlayGotcha.js / PlayTicTacToe.js   the other game scorers
  PlayBobs27.js / PlayCheckoutDrill.js / PlayScoringDrill.js   practice drills
  Practice.js             practice hub: bot ladder, drill launchers, PBs, trends
  GameSummary.js          end-of-game summary: winner, Elo, stats, rematch
  Leaderboard.js          sortable standings (Elo / X01 / Cricket MPR)
  Profile.js              player page: trend charts + game history
  PlayerCard.js           shareable stat card (canvas export with avatar)
  Matchup.js              Elo win-probability predictor + head-to-head
  Insights.js             AI chat interface (retired from the nav; unused)
  Account.js              profile settings, player color, theme, font scale
  Admin.js                admin panel (accounts, players, resets)
  tv/TVScoreboard.js      big-screen live scoreboards for every game
  tv/TVSummary.js         big-screen end-of-game summary
  Charts.js               dependency-free SVG line + bar charts
  DartBoard.js            SVG dartboard with highlights/hits
  ui.js                   shared UI: Logo, PlayerBadge, BackBar, Stat, Modal
lib/
  supabase.js             Supabase client
  cast.js                 TV-cast transport (Realtime broadcast + local)
  darts.js                shared dart/mark formatting helpers
  summary.js              builds the end-of-game summary from a finished match
  practice.js             ranked-vs-practice rule, practice rows, bot ladder, practice stats
  bots.js                 the bot roster (accuracy, checkout knowledge, colours)
  botStrategy.js          what a bot aims at in X01 / cricket / baseball
  board.js                real dartboard geometry (mm): point → segment, bed centres
  simulator.js            Gaussian throw simulator + seeded rng
  useBotTurn.js           React hook that throws a bot's visit one dart at a time
  drills.js               Bob's 27 / checkout / scoring drill rules
  checkouts.js            out-chart (string table + parsed darts)
  games.js                rematch + killer-number helpers
  db.js                   data access (players, game_results)
  stats.js                Elo math, career stats, timelines, head-to-head
  constants.js            targets, cricket values, Elo constants, player colors
  prefs.js                font-scale preference
  prodigy/parser.js       Prodigy D9000W board protocol parser
packages/
  scoring-core/           pure event-sourced scoring reducer (x01,
                          cricket, baseball) for the hardware bridge
tests/                    node --test suite: reducer units, parser units,
                          summary builder, practice rules, drills, board
                          geometry, bot strategy, simulator calibration
                          (Monte Carlo), app-vs-reducer conformance
                          fixtures (npm test)
tools/                    Prodigy capture/inventory scripts (see tools/README.md)
supabase/
  schema.sql              run once in the Supabase SQL editor
  migration-*.sql         historical one-off migrations (already applied)
```

## License
MIT.
