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

A public website at `/` explains the product; the scoring app itself lives
at `/app`. Sign-up is invite-only (a shared code), everyone signs in with
email and password, scores games on their phone, and results sync
instantly to everyone who follows them. A **Blackbird AI** tab answers
questions about your own games and draws charts, and every game gets a
**match report** and counts towards 32 **achievements**. Postgres is the
single source of truth for game data.

## Screenshots

*(Captured on a phone-sized viewport with demo data: six players and
~40 games played through the real scoring screens.)*

**Public website** (`/`) and invite-only sign-up:

<img src="docs/screenshots/website.png" width="740" alt="Blackbird website hero: Every Dart Counts. Make Yours Matter, with Sign In and Sign Up in the header">

| Sign up (invite code) | Loading screen | Loading (dark) |
|:---:|:---:|:---:|
| <img src="docs/screenshots/signup.png" width="240" alt="Create account form: invite code, display name, @handle, email"> | <img src="docs/screenshots/loading-light.png" width="240" alt="Blackbird splash: wordmark with spinning dartboard wheel, light theme"> | <img src="docs/screenshots/loading-dark.png" width="240" alt="Blackbird splash: wordmark with spinning dartboard wheel, dark theme"> |

| Home | Home (dark) | Game setup |
|:---:|:---:|:---:|
| <img src="docs/screenshots/home.png" width="240" alt="Home view: Start a Game, Practice and Bots, your games per week over the last 3 months, and the Top of the Board podium"> | <img src="docs/screenshots/home-dark.png" width="240" alt="Home view in the dark theme"> | <img src="docs/screenshots/setup.png" width="240" alt="New game setup: nine game types, three practice drills, cricket variants, friends or a bot"> |

| Live cricket (MPR column) | Live X01 | Game summary |
|:---:|:---:|:---:|
| <img src="docs/screenshots/cricket-live-mpr.png" width="240" alt="Cricket scoring screen with marks grid, points, live MPR per player and round number"> | <img src="docs/screenshots/x01-live.png" width="240" alt="501 scoring screen with the checkout suggestion and per-dart keypad"> | <img src="docs/screenshots/summary.png" width="240" alt="End-of-game summary: winner with Elo change, badges unlocked, ranked player cards"> |

| Match report | Cricket standings | Records |
|:---:|:---:|:---:|
| <img src="docs/screenshots/match-report.png" width="240" alt="Match report for a cricket game: side-by-side numbers and marks per round"> | <img src="docs/screenshots/leaderboard-cricket.png" width="240" alt="Standings sorted by cricket MPR with name tags and recent form"> | <img src="docs/screenshots/records.png" width="240" alt="League records: highest turn, checkout, best leg, best MPR game and more"> |

| Trend charts | X01 career card | Cricket career card |
|:---:|:---:|:---:|
| <img src="docs/screenshots/profile-mpr-chart.png" width="240" alt="Profile trend charts: win % and cricket MPR over time"> | <img src="docs/screenshots/profile-x01.png" width="240" alt="Profile X01 career card: average, first 9, checkout %, tons, busts, checkouts by finish size"> | <img src="docs/screenshots/profile-cricket.png" width="240" alt="Profile cricket career card: MPR, best MPR, miss %, dead darts and where darts land"> |

| Achievements | Friends | Practice & bots |
|:---:|:---:|:---:|
| <img src="docs/screenshots/achievements.png" width="240" alt="Achievements grid with unlocked badges and progress bars"> | <img src="docs/screenshots/friends.png" width="240" alt="Friends screen, opened from your profile: find players by name or @handle, following and followers"> | <img src="docs/screenshots/practice.png" width="240" alt="Practice hub with session counts and the eight-bot ladder"> |

| Your profile | Blackbird AI | Phone while casting |
|:---:|:---:|:---:|
| <img src="docs/screenshots/profile.png" width="240" alt="Your own profile: badge, @handle, bio, Following and Followers, Find friends and the settings gear; the bottom bar shows line-icon tabs and your avatar"> | <img src="docs/screenshots/ai.png" width="240" alt="Blackbird AI chat tab with suggested questions"> | <img src="docs/screenshots/phone-casting.png" width="240" alt="Simplified phone scoring UI while casting, showing the TV code"> |

**TV scoreboard** (`/tv`, paired with the phone by a 4-character code):

<img src="docs/screenshots/tv-cricket.png" width="740" alt="TV scoreboard showing a live cricket game with marks, points, MPR, whose throw it is and the turn's darts on the board">

<img src="docs/screenshots/tv-x01.png" width="740" alt="TV scoreboard showing a live 501 game with giant remaining scores">

<img src="docs/screenshots/tv-summary.png" width="740" alt="TV end-of-game summary: winner, Elo change, points per player and highlights">

## What it is (at a glance)

- **Profiles and @handles**: every player has a unique `@handle` chosen at
  sign-up (or from the Account page), a bio and a home bar/town, shown on
  their profile and stat card. Only the owning account can edit them.
- **Friends**: one-way follows. You see yourself plus the players you
  follow in standings, records, matchups, profiles and the AI coach, and
  the database enforces it. Name tags (a short code and/or an icon) sit
  beside every name. See [Friends, name tags and
  achievements](#friends-name-tags-and-achievements).
- **Player avatars and colors**: every player gets a colored circle badge
  with their initial letter, shown next to their name throughout the app.
  Colors are deterministic by default (a hash of the username) and can be
  customized in Account settings. The signed-in player's own badge is the
  far-right tab of the bottom bar and opens their profile.
- **Bottom bar**: line-icon tabs for Home, Play (a dot while a game is in
  progress), Stats, Matchup and Blackbird AI, then your avatar for your
  profile. Your profile holds Following / Followers, Find friends and the
  settings gear.
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
- **Home dashboard**: Start a Game and Practice & Bots, a bar chart of
  your own games per week over the last 3 months, a **podium/list leaderboard**
  with a toggle between views (podium shows the top 3 on a visual podium),
  and a **Highlights** section showing records from the last 3 months (most
  active player, most wins, best 3-dart average, highest turn, best
  checkout, best cricket MPR).
- **Stats**: win %, 3-dart average (overall and per dart position), highest
  turn, best leg, highest checkout, MPR, average runs, and more. Every
  game type has its own career card on the profile.
- **Match report and records**: tap any game in a history list for a
  side-by-side report with a per-round chart for each player. The Records
  screen (Stats → Records) holds league records and streaks for every
  game type. Both read through the stats engine in `lib/gamestats/`.
- **Blackbird AI**: the sparkle tab in the bottom nav is a chat about your
  own games (form, checkouts, records, rivals, trends, practice). Ask for
  a chart and the app draws one from its own numbers. Needs an AI provider
  key on the server (see [step 3](#3-pick-an-ai-provider-for-the-blackbird-ai-tab)).
- **Elo**: every multi-player game updates a shared Elo rating; the Matchup tab
  predicts win probability between any two players.
- **Player card export**: a canvas-rendered PNG stat card with player avatar,
  Elo, record, and key stats — auto-downloads on desktop and opens the
  share sheet on mobile.
- **Admin panel**: the configured admin account can manage login accounts,
  rename players, set or change anyone's @handle, hide/delete players and
  reset scores.
- **Public website + invite-only sign-up**: `/` is the marketing page
  (features, game modes, TV mode, FAQ) with Sign In / Sign Up in the
  header; once signed in the header shows Play and your avatar, and
  `/profile` lets you edit your name, @handle, bio, home bar and name tag
  and see your badges. Sign-up asks for
  a shared invite code and sends a Supabase invite email; the app itself
  lives at `/app`.
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
│  app/(marketing)  ── public  │
│    home page, /profile,      │
│    /privacy, /terms          │
│  app/(auth)  ── /login,      │
│    /signup, /reset (+accept/ │
│    confirm)                  │
│  app/app/page.js ── the      │
│    single-page app: auth     │
│    guard, views, live games  │
│                              │
│  app/api/signup/route.js     │  server-only: checks the invite
│    → Supabase admin invite   │  code, sends the invite email
│                              │
│  app/api/insights/route.js   │  server-only: holds the AI key,
│    → OpenAI/Gemini/Groq/     │  verifies the caller's Supabase
│      Anthropic               │  session before spending quota
│                              │
│  app/api/admin/route.js      │  server-only: holds the Supabase
│    → Supabase service role   │  service_role key; only the
│                              │  ADMIN_EMAIL account may call it
│                              │
│  app/api/link-players/       │  server-only: links unclaimed
│    route.js                  │  player rows to their accounts
│                              │
│  app/tv/page.js ── TV        │  no login; live over Realtime
└──────────────┬──────────────┘
               │ supabase-js (anon key + RLS)
┌──────────────▼──────────────┐
│  Supabase                    │
│  • Auth (email/password)     │
│  • Postgres: players,        │
│    game_results, follows,    │
│    matches (legacy), RLS     │
│  • Realtime broadcast (TV)   │
└─────────────────────────────┘
```

Key design points:

- **The app is client-rendered.** `app/app/page.js` is one client component that
  swaps between views (Home, Setup, live game screens, Game Summary,
  Practice, Standings, Records, Profile, Match report, Matchup, Friends,
  Blackbird AI, Account, Admin). Live game state lives in React state and
  is checkpointed in-memory so you can navigate away and resume.
- **Scoring math runs in the browser.** When a game finishes, one row per
  player is written to `game_results` with that player's full game stats as
  JSONB, and each player's new Elo is written back to `players`.
- **Aggregation happens at read time.** `lib/stats.js` and the stats engine
  in `lib/gamestats/` recompute career stats, timelines, records,
  achievements and head-to-head records from the raw `game_results` rows
  on every load — there are no denormalized aggregate tables to migrate.
- **Server routes exist only to protect secrets**: the AI key
  (`/api/insights`, behind the Blackbird AI tab) and the Supabase
  service-role key (`/api/admin`, `/api/signup`, `/api/link-players`).
  Each verifies the caller's Supabase session token or the invite code
  first.

## How the app works

1. **Open the app** — a branded splash (the Blackbird wordmark with a
   spinning mini dartboard as the loading wheel) shows for 1–3 seconds on
   every launch while auth and data load behind it.
2. **Sign up and sign in** — Sign Up on the website asks for the shared
   invite code, a name and an @handle and emails you an invite (a link and
   a six-digit code); set a password and you're in. Your display name is
   auto-added to the shared `players` list so others can follow you and
   pick you as an opponent.
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
7. **Browse stats** — Standings (Overall by Elo, X01 average, Cricket MPR,
   Baseball runs), Records, Profiles (career cards, trend charts,
   achievements, per-game history that opens a match report), Matchup (Elo
   win probability + head-to-head), Blackbird AI, and your Player Card.

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

Run `supabase/schema.sql` once in the Supabase SQL editor. Four tables:

- **`players`** — one row per dart player (a name, not a login):
  `username` (unique display name), `handle` (unique `@handle`, 3–20 chars
  of `a-z 0-9 _`), `bio`, `location`, `hidden` (kept out of standings),
  `color` (optional hex color for their avatar badge), `elo` (current
  rating), `auth_id` (the login account that owns the row, once claimed),
  `created_at`, and a **name tag**: `tag` (2–5 upper-case letters/digits)
  and `tag_icon` (an id from `lib/profile.js` `TAG_ICONS`), shown as a
  small pill beside the name everywhere. A trigger lets only the owning
  account edit `handle`, `bio`, `location` and the tag.
- **`game_results`** — one row **per player per finished game**: `game_id`
  (shared by all rows of one game), `username`, `game_type`
  (`x01` | `cricket` | `baseball`), `config`, `winner`, `result`
  (`win`/`loss`), `opponents`, `elo_after`, `completed_at`, and `stats` —
  a JSONB blob of that player's performance.
- **`follows`** — friends. One row per (account, player row) pair:
  `follower` (the account's auth id), `followed` (`players.id`),
  `created_at`. Follows are one-way with no accept step. Row Level
  Security on `game_results` only returns your own rows and the rows of
  players you follow, so standings, records, matchups, profiles and the
  AI coach are "you plus who you follow" by construction. Anyone can still
  insert result rows (whoever finishes a game writes every participant's
  row), so the restriction is on reading, not writing.
- **`matches`** — legacy one-row-per-game table kept for the admin "rebuild
  from old games" migration; new games do not write to it.

The `stats` JSONB per game type (**stats v2**, written by every play screen
since the recording contract in `lib/recorder.js`; older rows keep the
legacy keys only and the stats engine replays what it can):

| Game | Legacy keys (still written) | Added by v2 |
|------|--------|--------|
| every game | `dartsThrown`, `darts[]` (every dart as `{n, mult}`, misses included) | `v: 2`, `startedAt`, `durationMs`, `visits[]` — one entry per visit: `{ i, r, s0, darts: [{n, mult, t}], out }` (`r` = leg / inning / round / finish index, `s0` = state before the visit, `t` = ms since the game started, `out` = the visit's outcome) |
| x01 | `pointsScored`, `highestTurn`, `checkout`, `finalScore`, `dartPos[3]`, `legsWon` | `legs[]` (`{w, d, co, s0}` per leg; totals are now whole-match), `out = {k: score\|bust\|win, s, rem}` |
| cricket | `marks`, `rounds`, `roundMarks[]`, `mpr`, `pointsScored` | misses in `darts[]`, per-dart marks credited (`x.m`), `out = {marks, pts, dead}` |
| baseball | `runs` | `innings[]`, `out = {runs}` |
| aroundTheClock | `targetsHit` | `out = {hit, tgt}` |
| killer | `livesRemaining`, `isKiller` | `events[]` (`killer`, `hit`, `self`, `elim`), `out = {l, k, ev}` |
| shanghai | `totalScore`, `roundScores[]`, `shanghai` | `out = {s, sh}` |
| halveit | `finalScore`, `halves` | `roundScores[]` (0 when halved), `out = {s, halved, sc}` |
| gotcha | `finalScore`, `resetsDealt`, `resetsReceived` | `events[]` (`reset`), `out = {k, s, sc, reset[]}` |
| tictactoe | `squaresClaimed` | `line[]`, board strings in `s0` / `out.b`, `out.c` / `out.x` (claimed / cancelled squares) |
| bobs27 | `finalScore`, `doublesHit`, `roundsCompleted`, `busted` | `out = {hits, delta, sc}` |
| checkoutDrill | `finishes`, `hit`, `dartsPerHit`, `highestCheckout`, `results[]` | `out = {k: open\|hit\|bust\|miss, rem}` |
| scoringDrill | `total`, `turns`, `avgPerTurn`, `trebles`, `onTarget`, `hitRate`, `bestVisit` | `visitScores[]` (was `visits[]`), `out = {s}` |

`lib/gamestats/` is the **stats engine**: `analyzeGame(row)` turns any row
(v2 or legacy) into one normalized analysis with per-dart, per-visit and
per-round numbers plus quality flags saying what the row can and cannot
tell you; `computeCareer` aggregates per game type with coverage counts;
`computeRecords` finds league records for every game; the match report,
profile cards, end-of-game highlights and the AI coach all read through it.

`result` is `'win'` or `'loss'` for ranked games (two or more people, no
bot, not a drill) and **`'practice'`** for everything else: solo games,
games against a bot and drills. Practice rows keep the player's Elo
unchanged in `elo_after`, name the bot in `opponents` (`bot:rook` …) and
`config.bot`, and are split off before any stats, standings or Elo code
sees them. Bots never get a row of their own.

`lib/summary.js` turns these same fields into the end-of-game summary, so a
new game type needs a `describe` case there, recorder calls in its play
screen and an analyzer in `lib/gamestats/` to get a summary screen, a TV
summary, a match report and career cards.

Because `stats` is JSONB, adding new per-game fields requires **no SQL
migration** — old rows simply lack the new keys and the stats engine
tolerates that (and says so through its quality flags).

**Row Level Security**: any authenticated user in your Supabase project can
read, insert and update players (Elo writes) and insert results. Result
rows are only *readable* for yourself and the players you follow, and a
trigger keeps profile fields owner-only. Nobody can delete or rewrite
history through the anon key; destructive actions go through the admin
route with the service-role key.

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase anon key (public by design; RLS protects data) |
| `AI_PROVIDER` | server | `openai` (default), `gemini`, `groq`, or `anthropic` — powers the Blackbird AI tab via `/api/insights` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | server | key for the chosen provider |
| `AI_MODEL` | server | optional model override; blank = `gpt-6-luna` for `openai` |
| `AI_REASONING_EFFORT` | server | fixed OpenAI reasoning effort: `none` (default), `minimal`, `low`, `medium`, `high`; never set by the client |
| `AI_PRICE_INPUT_PER_1M` / `AI_PRICE_OUTPUT_PER_1M` | server | optional USD per 1M tokens, for the cost estimate in Admin → Analytics |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Saving games and Elo (`/api/record-game`; without it no game saves), Admin panel, invite sign-up (`/api/signup`) and saving training plans (`/api/plans`) |
| `ADMIN_EMAIL` | server | account allowed to use the Admin panel |
| `SIGNUP_INVITE_CODE` | server | the shared code the public Sign Up page asks for; unset = sign-up closed |
| `SITE_URL` | server | optional absolute origin for emailed links, canonical URL and sitemap (defaults to the Vercel production host) |

Server-side variables have no `NEXT_PUBLIC_` prefix, so they never reach the
browser.

# Deploy, start to finish

## 1. Code → GitHub
Push this repo to GitHub. Every later `git push` to `main` redeploys Vercel.

## 2. Supabase (database + login)
1. https://supabase.com → **New project** (set + save a DB password).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. Run `supabase/migration-add-profile.sql` (@handles and the owner-only
   profile guard) and then `migration-follows-tags.sql` (friends, name
   tags, follow-scoped result visibility). A database created before those
   columns existed also needs `migration-add-color.sql` and
   `migration-add-auth-id.sql` first; every migration is safe to re-run. The last one seeds follows between every pair of accounts
   that have a login, so nobody's standings go empty; guest rows without a
   login show up once someone follows them. Until it is run the app
   behaves as before: everyone sees everyone and the Friends screen says
   so.
   Then, in this order: `migration-tag-icons-covers.sql`,
   `migration-contours-cover.sql`, `migration-dev-tag-icons.sql`,
   `migration-player-events.sql`, `migration-ai-usage.sql`,
   `migration-realtime.sql`, `migration-scoped-data.sql`,
   `migration-ai-log.sql`, `migration-training-plans.sql`, and
   **`migration-lock-writes.sql` last**. The last one is the write
   lock-down: members may change only their own player row (never Elo or
   name), only the admin may change anyone's, and games are saved by
   `/api/record-game` with the service role, so deploy the app before
   running it. Until it runs, members can't add or edit players on a fresh
   install. `tests/sql/run.sh` applies the same list in the same order.
4. **Settings → API** → copy **Project URL** and the **anon public** key.
5. **Authentication → Providers → Email**: enabled, with "Confirm email"
   **ON**. New players arrive through an invite email, and accepting it
   confirms the address in the same step.
6. **Authentication → Settings**: keep "Allow new users to sign up" **OFF**.
   The public Sign Up page does not call Supabase sign-up directly; it posts
   to `/api/signup`, which checks `SIGNUP_INVITE_CODE` and sends an invite
   through the admin API (needs `SUPABASE_SERVICE_ROLE_KEY`). Rotate the
   code in Vercel to close the door.
7. **Authentication → Email Templates**: paste the branded templates from
   `supabase/email-templates/` (invite, reset password, confirm signup).
   Each email carries a one-tap link **and** a six-digit code; the code
   works on any device at `/signup/accept` or `/reset/confirm`. For a sender
   on your own domain and real sending volume, enable custom SMTP (see that
   folder's README).
8. **Authentication → URL Configuration**: Site URL = your production URL.
   The email logo loads from `<Site URL>/brand/email-lockup.png`.
   Redirect URLs: `https://<your domain>/signup/accept`,
   `https://<your domain>/reset/confirm`, `https://<your domain>/login`,
   plus `http://localhost:3000/**` for local work. The invite and reset
   email templates must keep `{{ .ConfirmationURL }}`.

## 3. Pick an AI provider (for the Blackbird AI tab)

The sparkle tab in the bottom nav is a chat about the signed-in player's own
games: form, checkouts, records, rivals, trends and practice. Every X01 dart
log is replayed in the browser (`lib/x01log.js`) so the coach can see
checkout chances, checkout percentage, busts and 100+/140+/180 visits, and
`lib/aiSummary.js` adds monthly and weekly trend tables. Ask for a chart
("chart my checkout % by month") and the reply comes back with one drawn by
the app from its own numbers. It needs one provider key on the server;
without one the tab shows "Blackbird AI isn't switched on yet".

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
   Environment Variables). `SUPABASE_SERVICE_ROLE_KEY` powers saving
   games (`/api/record-game`), the Admin panel and invite sign-up; `SIGNUP_INVITE_CODE` is the code you hand out.
3. **Deploy.** You get `https://….vercel.app`. Every `git push` redeploys.
4. Supabase → **Authentication → URL Configuration** → Site URL and the
   redirect URLs from step 2.8 above, using your Vercel or custom domain.
5. Vercel → **Settings → Deployment Protection**: production must be open
   to the public, or attach a custom domain (custom domains are exempt).
   The website, sign-in and TV pages return 403 to everyone else while
   Vercel Authentication covers production.

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

## Friends, name tags and achievements

- **Friends** (your profile → Following / Followers / Find friends, or
  Standings → Friends):
  follow people by name or @handle. Standings, records, matchups,
  profiles and the AI coach show you plus the players you follow, and the
  database enforces it. Anyone who follows you sees your games.
- **Name tags**: a 2–5 character tag and/or an icon shown beside your name
  everywhere (Account → Profile, or the website's profile page).
- **Achievements**: 32 badges (milestones, scoring, finishing, cricket,
  streaks, social, practice, variety) derived from your game history in
  `lib/achievements.js`, so they are always correct and unlock
  retroactively. The game that earns a badge shows a "Badge unlocked"
  moment after the winner; profiles carry the full grid with progress
  bars; the website profile shows a badge strip.

## Known limitations (by design)

- Friends are one-way: anyone who follows you sees your games; there is
  no accept step. Result rows are readable only by yourself and your
  followers, but any member can still *insert* rows under any username
  (the scorer writes every participant's row), exactly as before.
- X01 double-out is trusted, not verified (you enter darts per turn).
- Best-of legs are X01 only.
- Multiplayer Elo updates the winner pairwise; losers aren't ranked vs each
  other.
- Cricket games recorded before v1.2 have game totals (`marks`, `rounds`) but
  no per-round breakdown, and their MPR was counted under the old
  every-hit-counts rule.
- AI insights reflect only the stats in your database; with few games they're
  thin. Checkout percentage needs the per-game dart log, so games recorded
  before dart logging (and the earlier legs of a best-of match, whose log
  only covers the final leg) count finishes but not chances.

## Project structure
```
app/
  layout.js               root layout, metadata, Figtree via next/font
  fonts.js / fonts/       self-hosted Figtree (WOFF2, SIL OFL)
  globals.css             design system (tokens, light/dark, cards, nav, TV)
  (marketing)/            public site: / (page.js), /profile (view + edit
                          your player profile), /privacy, /terms,
                          marketing.css (mk- prefixed port of the site CSS)
  (auth)/                 /login, /signup, /signup/accept, /reset,
                          /reset/confirm
  app/page.js             the app: auth guard, views, live-game state
  api/signup/route.js     invite-code check + Supabase admin invite
  api/insights/route.js   server-side AI call (secret key lives here)
  api/admin/route.js      admin actions via Supabase service role
  api/link-players/       links unclaimed player rows to their accounts
  tv/page.js              TV scoreboard: code entry + live big-screen views
  robots.js / sitemap.js  crawl rules: only / is indexable
components/
  marketing/              header (session-aware), hero, product preview,
                          game modes, TV mock + setup flow, FAQ, footer…
  auth/                   sign in, invite sign-up, reset, set password
  RegisterSW.js           registers the offline worker (production only)
  StandaloneRedirect.js   home-screen installs open the app, not the site
  LoadingScreen.js        launch splash (spinning board, seasonal touches)
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
  Celebration.js          confetti moments on the summary (win, badge unlocked)
  GameDetail.js           match report: side-by-side numbers, per-round charts
  Leaderboard.js          standings (Overall Elo / X01 / Cricket / Baseball)
  Records.js              league records and streaks for every game type
  Profile.js              player page: career cards, trends, badges, history
  CareerCards.js          one career card per game type played
  Achievements.js         badge grid with progress bars
  Friends.js              follow / unfollow by name or @handle
  TagEditor.js            name tag editor (app Account + website profile)
  PlayerCard.js           shareable stat card (canvas export with avatar)
  Matchup.js              Elo win-probability predictor + head-to-head
  BlackbirdAI.js          Blackbird AI tab: chat about your own games, with charts
  Account.js              settings (gear on your profile): name, handle, color, theme, text size
  Admin.js                admin panel (accounts, players, resets)
  tv/TVScoreboard.js      big-screen live scoreboards for every game
  tv/TVSummary.js         big-screen end-of-game summary
  Charts.js               dependency-free SVG line + bar charts
  DartBoard.js            SVG dartboard with highlights/hits
  ui.js                   shared UI: Logo (official SVGs), PlayerBadge, BackBar, Stat, Modal
docs/screenshots/         README screenshots
lib/
  supabase.js             Supabase client
  cast.js                 TV-cast transport (Realtime broadcast + local)
  darts.js                shared dart/mark formatting helpers
  recorder.js             stats v2 recording contract used by every play screen
  gamestats/              stats engine: per-game analyzers, career, records
  achievements.js         badges derived from game history
  follows.js              friends: who I follow, who follows me, my circle
  profile.js              @handle rules and name-tag icons
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
  x01log.js               replays an X01 dart log: checkout chances, busts, tons
  aiSummary.js            the player summary Blackbird AI reads (totals, trends, series)
  aiChart.js              the chart block protocol between the model and the chat
  constants.js            targets, cricket values, Elo constants, player colors
  prefs.js                font-scale preference
  occasions.js            date-triggered splash flourishes (birthday, snow)
  authRedirect.js         safe post-sign-in redirect paths
  siteUrl.js              absolute site origin for links and the sitemap
  useSession.js / useMyPlayer.js / useMyAchievements.js   website hooks
  marketing/games.js      game-mode copy for the website
  prodigy/parser.js       Prodigy D9000W board protocol parser
packages/
  scoring-core/           pure event-sourced scoring reducer (x01,
                          cricket, baseball) for the hardware bridge
tests/                    node --test suite: reducer units, parser units,
                          summary builder, practice rules, drills, board
                          geometry, bot strategy, simulator calibration
                          (Monte Carlo), stats engine, achievements,
                          follows, AI summary/charts, app-vs-reducer
                          conformance fixtures (npm test)
tools/                    Prodigy capture/inventory scripts (see tools/README.md)
supabase/
  schema.sql              run once in the Supabase SQL editor
  migration-*.sql         one-off migrations, safe to re-run (see Deploy step 2.3)
  email-templates/        branded invite / reset / confirm emails
```

## License
MIT.
