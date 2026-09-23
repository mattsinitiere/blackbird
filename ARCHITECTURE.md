# Blackbird — Architecture

How the app works, start to finish. This is the technical companion to
[README.md](README.md) (setup/deploy) and [ROADMAP.md](ROADMAP.md) (future
work). Accurate as of v1.3.

---

## 1. Context

Blackbird is a private dart-scoring web app for a league of friends. One
person scores each game on a phone; everyone's stats, Elo ratings, and
history live in a shared Postgres database and are visible to the whole
group instantly. Over time it has grown live TV scoreboards, per-round
cricket MPR analytics, seasonal easter eggs, a public marketing site with
invite-only sign-up, and one design system shared by site and app.

Guiding constraints that explain most design decisions:

- **Tiny team, zero ops.** Everything runs on two managed services (Vercel +
  Supabase). No servers to patch, no queues, no cron.
- **Phones first.** Scoring happens standing at a dartboard. Big targets,
  little typing, works as an add-to-home-screen web app.
- **Postgres is the single source of truth.** No game data in localStorage;
  the only client-side persistence is the Supabase session token and one TV
  display preference.
- **Schema-light.** Per-game statistics are JSONB blobs, so new games and new
  metrics ship without SQL migrations.
- **No emojis in the UI.** All iconography is flat, single-color inline SVG
  (`currentColor` / theme tokens).

## 2. System topology

```
┌────────────────────────────────────────────────────────────┐
│ Clients                                                    │
│  • Phones (primary scoring UI, add-to-home-screen)         │
│  • Tablets / desktops (same app, wider layout)             │
│  • TVs (/tv page: smart-TV browser, AirPlayed window,      │
│    or Chromecast tab — read-only live scoreboard)          │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼─────────────────────────────────┐
│ Vercel — Next.js 14 (App Router)                           │
│                                                            │
│  app/(marketing)        public site: /, /privacy, /terms   │
│  app/(auth)             /login /signup /reset (+ accept)   │
│  app/app/page.js        the entire interactive app (client)│
│  app/tv/page.js         TV scoreboard (client, no auth)    │
│  app/api/signup/route.js     server-only: invite sign-up   │
│  app/api/insights/route.js   server-only: AI provider call │
│  app/api/admin/route.js      server-only: service-role ops │
│                                                            │
│  Static assets, CSS, fonts served from the same deploy.    │
│  Every push to main auto-deploys production.               │
└──────────────────────────┬─────────────────────────────────┘
                           │ supabase-js v2 (anon key)
┌──────────────────────────▼─────────────────────────────────┐
│ Supabase                                                   │
│  • Auth: email/password; user prefs in user_metadata       │
│  • Postgres: players, game_results, matches (legacy)       │
│    guarded by Row Level Security                           │
│  • Realtime: broadcast channels for phone→TV casting       │
│    (no tables involved, transient messages only)           │
└────────────────────────────────────────────────────────────┘
```

Three API routes exist **only** to keep secrets off the client: the AI
provider key (`/api/insights`), and the Supabase `service_role` key
(`/api/admin`, and `/api/signup` which also holds the invite code).
Everything else — scoring, stats, Elo, casting — runs in the browser
against Supabase with the public anon key + RLS.

## 3. Repository layout

```
app/
  layout.js               root layout, metadata, viewport, Figtree font
  fonts.js, fonts/        next/font/local config + WOFF2 files
  globals.css             the design system (tokens, light + dark themes,
                          components, TV styles, seasonal effects)
  (marketing)/layout.js   public-site frame: header, footer, forces light
  (marketing)/page.js     the marketing home page (sections in
                          components/marketing)
  (marketing)/marketing.css  mk-prefixed port of the standalone site CSS
  (marketing)/privacy, terms  draft legal pages
  (auth)/…                /login, /signup, /signup/accept, /reset,
                          /reset/confirm (server pages, client forms)
  app/page.js             THE app: splash gate, auth guard (redirects to
                          /login), view router, live-game state, TV-cast
                          publisher
  app/layout.js           noindex + service-worker registration
  tv/page.js              TV scoreboard page (standalone, no auth)
  api/signup/route.js     invite-code check → Supabase admin invite email
  api/insights/route.js   AI call (verifies Supabase JWT first)
  api/admin/route.js      admin ops via service role (verifies admin email)
  robots.js, sitemap.js   only / is indexable
components/
  marketing/              MarketingHeader + AuthNav (session-aware), Hero,
                          DotGrid, ProductPreview, Capabilities, Features,
                          GameModes, TVSection/TVPreview/DartboardSvg,
                          SetupFlow, FAQ, Closing, Footer, LegalPage
  auth/                   AuthCard, SignInForm, SignUpForm (invite),
                          ResetRequestForm, SetPasswordForm
  RegisterSW.js           registers /sw.js in production
  Home.js                 dashboard: stat tiles, games/week chart, top 5
  Setup.js                game type + options + player picker
  PlayX01.js              X01 engine + UI (per-dart entry)
  PlayCricket.js          cricket engine + UI (marks, MPR, variants)
  PlayBaseball.js         baseball engine + UI (9 innings + extras)
  PlayBobs27.js / PlayCheckoutDrill.js / PlayScoringDrill.js
                          practice drills (always saved as practice)
  Practice.js             practice hub: bot ladder, drills, PBs, trends
  Leaderboard.js          standings by Elo / X01 avg / cricket MPR
  Profile.js              player page: trend charts, per-game history
  PlayerCard.js           canvas-rendered shareable stat card (PNG export)
  Matchup.js              Elo win-probability + head-to-head
  Insights.js             AI Q&A over pre-aggregated league stats
  Account.js              display name, theme, text size, player colour
  Admin.js                user management, resets
  LoadingScreen.js        splash: wordmark + dartboard spinner + occasions
  Charts.js               dependency-free SVG LineChart + BarChart
  DartBoard.js            SVG dartboard (highlights + hit markers)
  ui.js                   shared bits: icons (flat SVG), BackBar, Modal…
  tv/TVScoreboard.js      big-screen cricket/X01/baseball views
lib/
  supabase.js             client factory (null when unconfigured)
  db.js                   data access: players + game_results
  stats.js                Elo math, career stats, timelines, H2H, replay
  cast.js                 TV-cast transport (Realtime + local test mode)
  darts.js                shared dart/mark formatting
  practice.js             isRankedMatch, buildResultRows, splitResults,
                          botLadder, computePractice
  bots.js                 bot roster: sigma (mm), checkout knowledge, colours
  botStrategy.js          per-game aim selection + botThrow
  board.js                dartboard geometry in mm (segmentAt, aimPoint)
  simulator.js            Gaussian landing error, seeded rng
  useBotTurn.js           hook that fires a bot's next dart on a timer
  drills.js               drill rules (Bob's 27, checkout, scoring)
  checkouts.js            out-chart + parseCheckout
  occasions.js            date-triggered splash flourishes
  prefs.js                font-scale preference
  constants.js            targets, cricket values, Elo K, player colours…
  useSession.js           shared session hook for public pages
  authRedirect.js         safeNext(): same-site post-login redirects only
  siteUrl.js              absolute origin for canonical/sitemap links
  marketing/games.js      the nine game-mode blurbs
  prodigy/parser.js       Prodigy D9000W protocol parser (CRLF line
                          framing, Dart:/Reset:/Clarity:/Metadata:)
packages/
  scoring-core/           pure event-sourced scoring reducer shared by
                          the web UI (via conformance fixtures today) and
                          the future Prodigy hardware bridge: x01,
                          cricket (incl. MPR rule), baseball, serialize/
                          replay, deriveCompletedResult
tests/
  scoring-core.test.mjs   unit tests for the reducer (node --test)
  prodigy-parser.test.mjs parser unit tests
  conformance.test.mjs    replays app-captured fixtures through the
                          reducer and asserts identical results
  fixtures/               ground-truth game recordings from the real UI
tools/
  prodigy-logger.mjs      passive WebSocket capture for the board (lab)
  prodigy-inspect.sh      read-only SD-image inventory script
supabase/
  schema.sql              run once: tables + RLS policies
docs/screenshots/         README images
docs/prodigy-development-guide.md   hardware integration plan
```

There are **four JS dependencies**: `next`, `react`, `react-dom`,
`@supabase/supabase-js`. Charts, dartboard, confetti, snow, casting — all
hand-rolled. This is deliberate: no supply-chain surface, no bundle bloat.

## 4. Boot sequence (what happens when you open the app)

1. **Static HTML arrives** from Vercel (the page is client-rendered; the
   prerendered shell shows the splash).
2. **Splash** (`LoadingScreen`): Blackbird wordmark + one-color 8-section
   dartboard spinner. `page.js` starts a timer of `1000 + rand(0..2000)` ms;
   the splash is held until BOTH the timer elapses and auth resolves, so
   every launch has 1–3 s of branded "perceived loading" even when cached.
   After mount the splash checks `lib/occasions.js` — Sep 11 adds confetti
   + a party hat on the wordmark; any December day adds falling snow;
   `?occasion=birthday|snow` previews them (effects render post-mount so
   prerendered HTML stays date-independent; hidden under reduced-motion).
3. **Config gate**: if `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` are missing,
   a "Setup needed" card renders instead (the supabase client is `null`).
4. **Auth resolution**: `supabase.auth.getSession()` reads the persisted
   session from localStorage (no network on the happy path). No session →
   `router.replace("/login?next=/app")` (or `/` right after signing out).
   The forms under `components/auth` sign in with `signInWithPassword`;
   sign-up is invite-only (`/api/signup` → admin invite email →
   `/signup/accept` sets the password); reset is
   `resetPasswordForEmail` → `/reset/confirm`.
5. **Preference application** (effect on `session`): reads
   `user.user_metadata` and applies
   - `theme` → `data-theme` attribute (`light` default / `dark`)
   - `fontScale` → `--fs` and `--fs-chrome` vars (content vs chrome scaling)
   The brand accent is fixed by the design system; an older `accent` or
   `skin` value in metadata is ignored.
6. **Data load**: `getPlayers()` + `getGameResults()` in parallel — the app
   loads **all** result rows and derives everything client-side (§7). The
   splash shows "loading…" until both resolve. A visibility-change listener
   refetches when the app regains focus; the header has a manual refresh.
7. **Self-registration**: if the signed-in display name isn't in the shared
   `players` table yet, it is inserted, so every account automatically
   appears in everyone's opponent picker.
8. **Render**: view state machine in `page.js` (`home`, `setup`, `playX01`,
   `playCricket`, `playBaseball`, `leaderboard`, `profile`, `matchup`,
   `insights`, `account`, `admin`) — plain `useState`, no router; the whole
   app is one URL, `/app`. The public site at `/` reads the same session
   through `lib/useSession.js` to swap Sign In / Sign Up for Play.

## 5. Identity & authorization model

- **Login accounts** (Supabase Auth) and **players** (rows in `players`)
  are distinct: a player is just a name that appears in games; an account
  gets linked to a player by its `display_name`. Guests can be added as
  players without accounts (optionally `hidden` from standings).
- **Per-user preferences** live in `user_metadata` (theme, fontScale,
  display_name, handle) — updated via `supabase.auth.updateUser`, no
  custom tables.
- **Sign-up is invite-only.** Supabase self-service sign-up is off; the
  public form posts to `/api/signup`, which compares the code against
  `SIGNUP_INVITE_CODE` in constant time and calls
  `auth.admin.inviteUserByEmail` with the display name and handle. Any
  authenticated account can still read the whole league (the RLS posture
  below), which is why the door is a shared code rather than open.
- **RLS posture** (see `supabase/schema.sql`): any *authenticated* account
  may read and insert players/game_results and update players (needed for
  Elo write-back). Nothing is deletable or rewritable via the anon key —
  destructive operations exist only behind `/api/admin`.
- **Admin** = the single email in `ADMIN_EMAIL` (checked client-side for UI
  and re-verified server-side in `/api/admin`, which is the only holder of
  the service-role key). Admin can manage accounts, delete/hide players,
  reset scores.
- The **TV page requires no login**: it only listens to broadcast state
  keyed by a room code (§9's threat model: worst case, a guessed code sees
  a scoreboard).

## 6. Data model

Three tables (full DDL in `supabase/schema.sql`):

- **`players`** — `username` (unique), `hidden`, `elo` (current rating,
  default 1000), `created_at`.
- **`game_results`** — **one row per player per finished game**:
  `game_id` (uuid shared by the rows of one game), `username`, `game_type`,
  `config` (jsonb), `winner`, `result` ('win'/'loss', or 'practice' for
  solo, bot and drill games), `opponents` (jsonb array; a bot appears as
  its id, e.g. `bot:rook`), `stats` (jsonb, per-player performance),
  `elo_after` (unchanged on practice rows), `completed_at`. Bots never get
  a row; `lib/practice.js` owns the ranked-vs-practice rule and the row
  shaping, and `page.js` splits fetched rows into competitive and practice
  lists so stats, standings and Elo only ever see the former.
- **`matches`** — legacy one-row-per-game table; kept only for the admin
  "rebuild from old games" migration (`stats.js: replayMatchesToResults`).
  New games never write to it.

`stats` JSONB shapes by game type:

| Game | Stats blob |
|------|-----------|
| x01 | `dartsThrown`, `pointsScored`, `highestTurn`, `checkout`, `finalScore`, `darts[]` (every dart as `{n, mult}`), `dartPos[3]` (per-position sum/count) |
| cricket | `marks`, `rounds`, `roundMarks[]` (marks per round), `mpr`, `pointsScored`, `darts[]` |
| baseball | `runs`, `darts[]` |

Because `stats` is free-form JSONB, **adding a stat or a whole game type
requires no migration** — old rows simply lack the new keys and the readers
tolerate that (e.g. cricket games recorded before per-round tracking have
totals but no `roundMarks`).

## 7. Read path: aggregation at read time

There are no aggregate tables, no materialized views, no cron. On every
load the client pulls all `game_results` rows and derives:

- **`computeStats(results)`** (`lib/stats.js`) → per-player career stats:
  overall W/L and win %, X01 3-dart average (points/darts×3), per-dart-
  position averages, highest turn, best leg, highest checkout; cricket
  career MPR (total marks ÷ total rounds — a properly weighted average),
  best single-game MPR, points; baseball run averages.
- **`playerTimeline(results, user)`** → chronological series for the
  profile charts: Elo after each game, cumulative win %, X01 average per
  game, cricket MPR per game (works retroactively from stored
  `marks`/`rounds`).
- **`headToHead(results, a, b)`** → record between two players, computed
  from A's own rows (stays correct even if an opponent was reset).
- **Home dashboard** buckets unique games (dedup by `game_id`) into 13
  seven-day windows for the games-per-week bar chart.

Tradeoff: O(all rows) on every load. For a friends league (thousands of
rows at most) this is milliseconds and keeps the write path trivially
simple. If the app ever hosted many leagues, this is the first thing to
revisit (see ROADMAP #30).

## 8. Write path: the game engine

### The contract

Every game type plugs into the same pipeline:

```
Setup.js            builds  game = { id, gameType, players[], config }
page.js             holds it in state; renders the matching Play component
Play*.js            receives { game, resume, onProgress, onFinish, onQuit,
                               castActive }
  onProgress(state)   fired on EVERY state change (entire state as JSON)
  onFinish(match)     match = { id, gameType, config, players, winner,
                                perPlayer, completedAt }
page.js.finishMatch  computes Elo, writes rows, refreshes, resets view
```

- `onProgress` feeds two consumers: a `useRef` (`liveProgress`) used to
  **resume** the live game if the user navigates away and back, and the
  **TV-cast publisher** (§9). It is an in-memory checkpoint only — a page
  reload loses the live game (ROADMAP #24).
- **Solo games are practice**: `lib/practice.js` `isRankedMatch` decides
  (two or more real players, no bot, not a drill). Practice games are
  saved with `result = 'practice'` and the player's Elo unchanged; the
  shell splits fetched rows into competitive and practice lists so stats,
  standings and Elo never see them.
- All three engines share an **undo pattern**: a `history` array of
  deep-cloned state snapshots per committed turn; undo pops the current
  uncommitted dart first, then restores the last snapshot.

### X01 (`PlayX01.js`)

Per-dart entry (`{n, mult}`, bull = `{25,2}`, miss = `{0,0}`). Each dart
recomputes remaining: `<0` busts the turn (score restored, darts still
counted, position averages count zeros); `0` wins if straight-out or the
last dart was a double (double-out), else bust; `1` remaining under
double-out busts; 3 darts commit normally. Winner's `checkout` is the score
they stood on. Per-position sums power the 1st/2nd/3rd-dart averages.

### Cricket (`PlayCricket.js`)

Targets 20…15 + Bull; ring selector (single/double/triple, bull max
double) then target; up to 3 darts per turn, committed by "End turn".
Variants: **standard** (close + lead on points), **cutthroat** (points are
given to open opponents; lowest wins), **no-score** (first to close all).

**MPR uses the standard league rule**: darts that advance closing a number
always count; hits beyond a close count only while at least one opponent
still has the number open (i.e. while they can score); dead darts count 0.
Each turn's effective marks are appended to `roundMarks`, so every game
stores its round-by-round history; live MPR (`markCount / rounds`) renders
in the scoreboard during play and on the TV.

### Bots

A bot is a player id with the `bot:` prefix (`lib/bots.js`), so it rides
through `players`, `perPlayer`, the turn cursor and the cast payload like
anyone else; `PlayerBadge` and the summaries render it by name. When the
current player is a bot, `lib/useBotTurn.js` fires one throw after 0.75 s
each time the visit key (turn + darts thrown) changes. The throw picks a
target (`lib/botStrategy.js`: the out-chart in X01 with a per-bot chance
of "not knowing" the setup shot, the highest open number then scoring
numbers in cricket, the inning's triple in baseball), samples a landing
with the bot's `sigma` through the real board geometry
(`lib/board.js`, `lib/simulator.js`) and calls the component's own
`addDart`, so busts, checkouts, legs, undo snapshots and the TV cast all
behave exactly as for a person. The keypad is locked while the bot
throws. Each bot's `sigma` was fitted so aiming at T20 reproduces its
nominal 3-dart average; `tests/simulator.test.mjs` re-checks that by
Monte Carlo. The ladder (`botLadder`) is derived from practice rows: a
bot unlocks once the one below it has been beaten.

### Baseball (`PlayBaseball.js`)

9 innings, target number = inning (continuing 10…20 for extras). Four
buttons (single/double/triple/miss); runs = multipliers on the target.
After inning 9, a unique leader ends the game, otherwise extra innings.

## 9. TV cast mode

Design goal: the classic pub-TV scoreboard — game huge on the TV, phone
reduced to big entry buttons — with **no native app and no login on the
TV**.

### Transport (`lib/cast.js`)

One interface, two implementations:

- **Supabase Realtime broadcast** (production): channel `cast:<CODE>`,
  where CODE is 4 characters from an ambiguity-free alphabet
  (`ACDEFHJKMNPRTWXY34679`). Broadcast is transient pub/sub — no tables,
  no rows, no auth required.
- **`window.BroadcastChannel`** (tests/dev, enabled by `?localcast=1` or
  `NEXT_PUBLIC_CAST_TRANSPORT=local`): same-browser transport so the
  Playwright harness can drive a phone page and a TV page against a mocked
  Supabase with full fidelity.

Events:

| Event | Direction | Meaning |
|-------|-----------|---------|
| `state` | phone → TVs | `{game, snapshot}` on every scoring change (throttled ~200 ms, undo `history` stripped — it grows unboundedly) |
| `finished` | phone → TVs | winner screen |
| `ended` | phone → TVs | game quit, cast still active → TV waits for next game |
| `stopped` | phone → TVs | casting stopped → TVs drop to code entry |
| `hello` | TV → phone | sent once the TV's channel is actually SUBSCRIBED (an `onReady` callback avoids the race where the reply beats the join); the phone answers with the current snapshot, or `ended` if nothing is live — this is how late joiners sync |

### Lifecycle

Phone: "Cast to TV" (flat vector icon) on any live game → generates code,
opens channel, shows code chip; publisher hooks the existing `onProgress`
feed in `page.js.saveProgress`. The code persists across games until Stop.
`finishMatch`/`quit` clear any queued throttle timer *before* emitting
`finished`/`ended` so a stale `state` can never overwrite the winner
screen. While casting, play components receive `castActive` and collapse
their scoreboard + dartboard into entry-only UI (X01 keeps a compact
"remaining" readout).

TV (`app/tv/page.js`): state machine `enter-code → waiting → live →
finished → …`. Forced dark theme. Wrong/typo'd codes are surfaced by an
8-second no-answer timeout ("no phone answered — check the code") instead
of waiting forever. Multiple TVs can join one code (broadcast fan-out).

### Display

`components/tv/TVScoreboard.js` renders per-game big views as **pure
functions of the broadcast snapshot** (no local game logic): cricket marks
grid + points + live MPR + round, giant X01 remaining + averages, baseball
box score — alongside the same `DartBoard` SVG the phone uses, with the
thrower's open numbers outlined and the turn's darts plotted. A footer
toggle ("hide board" / "show board", persisted per TV in localStorage)
switches to a score-only layout with extra-large type. Typography is
viewport-scaled (`clamp`/vw) and independent of the phone's font-scale
preference.

## 10. Elo

`applyEloUpdate` (`lib/stats.js`): K=24, base 1000. The winner is updated
pairwise against each loser (`expected = 1/(1+10^((Rl−Rw)/400))`); losers
move only versus the winner, not each other. Each result row stores
`elo_after` for the timeline; current ratings live on `players.elo`. The
Matchup tab converts a rating gap to a win probability with the same
logistic. The admin "rebuild" action can replay legacy `matches`
chronologically to regenerate rows and ratings.

## 11. Presentation system

Everything visual flows from CSS custom properties in `globals.css`:

- **Tokens**: `--bg/--surface/--surface-2/--ink/--ink-soft/--muted/
  --line/--line-strong`, `--accent/--accent-hover/--accent-soft/
  --accent-line/--on-accent/--accent-glow`, `--live/--live-soft` (the
  current thrower — the one non-brand colour), `--red/--amber`,
  `--radius/--radius-sm/--radius-xs`, `--shadow/--shadow-sm/--shadow-lift`,
  font stacks built on `--font-figtree` from `next/font`.
- **Themes** (user-selectable in Account) via `data-theme`: `light` is the
  marketing site's palette (navy `#1b1942` on `#fcfcfd`); `dark` is
  derived from its TV preview (lavender `#a9a3dc` on `#101419`, navy text
  on filled controls). The public pages force light. Text scale (`--fs`
  for content, gentler `--fs-chrome` for shell) is per-account. The accent
  is not user-adjustable.
- **Shape language** (from the website): 1px borders with soft shadows,
  7px buttons and inputs, 10px cards and nav, weight-500 headings,
  uppercase tracked labels. Selected states fill with the accent; the
  player at the oche gets `.card.is-live` (green).
- **Marketing CSS** lives apart in `app/(marketing)/marketing.css`: every
  class is `mk-` prefixed and element rules are scoped with
  `:where(.mk-root)` (zero extra specificity), so both stylesheets can be
  loaded at once after client-side navigation without leaking.
- **Logo**: `Logo` in `ui.js` renders the official SVGs from
  `public/brand` (lockup, wordmark, icon) and CSS shows the colour or
  white file per theme.
- **Responsive**: one codebase, three classes — phones (base), ≥900 px
  (wider container, two-column profile charts, centered nav), TV (`.tv`
  scope, vw-scaled).
- **Iconography**: inline single-color SVGs (`GearIcon`, `CastIcon`, back
  chevron, dartboard spinner, party hat) — never emojis.
- **Charts** (`Charts.js`): dependency-free SVG line/bar charts sharing one
  axis style; percent axes clamp to 0–100.

## 12. Server routes

### `/api/insights` (POST)

The only AI touchpoint. The client pre-aggregates a compact league summary
(never raw rows), sends `{kind: league|player|matchup|custom, summary,
question?}` with the caller's Supabase access token. The route verifies the
token server-side, builds a prompt, and dispatches on `AI_PROVIDER`:
Gemini (default) / Groq / OpenAI / Anthropic, each with a default model
and key from non-public env vars. Response: `{text, model}`.

### `/api/admin` (POST)

Requires a valid session token AND the caller's email to equal
`ADMIN_EMAIL`; only then uses `SUPABASE_SERVICE_ROLE_KEY` (which bypasses
RLS) for account listing/updating/deleting, player delete/hide, score
resets, and the legacy-match rebuild.

### `/api/signup` (POST)

Invite-only account creation. Takes `{code, email, displayName, handle}`,
compares `code` with `SIGNUP_INVITE_CODE` in constant time (with a small
per-instance attempt limit on top of Supabase's own auth rate limits),
validates the handle with `lib/profile.js`, then calls
`auth.admin.inviteUserByEmail` with the service-role key. The emailed
link lands on `/signup/accept`, where the new player chooses a password;
accepting the invite also confirms the address. An email that already
has an account gets a 409. Supabase's own "Allow new users to sign up"
stays off, so nothing bypasses the code.

## 13. Build, deploy, environments

- `git push` to `main` → Vercel builds (`next build`) and deploys
  production; other branches get preview URLs automatically.
- Runtime configuration is entirely env vars (see README table):
  Supabase URL/anon key (public), AI provider/key/model, service-role key
  and `SIGNUP_INVITE_CODE` (server-only), optional `SITE_URL`. No `.env`
  in the repo.
- `next.config.mjs` sends a Content-Security-Policy (same-origin plus the
  Supabase REST and Realtime hosts; `'unsafe-inline'` only where Next's
  hydration scripts and React's style attributes require it), nosniff,
  frame denial, referrer and permissions policies on every response.
- The Supabase schema is applied once by pasting `supabase/schema.sql`
  into the SQL editor; day-to-day feature work needs no DB changes thanks
  to the JSONB stats design.

## 14. Testing & verification approach

Two layers:

**Committed test suite** (`npm test` → `node --test tests/*.test.mjs`,
no test-framework dependency):

- `tests/scoring-core.test.mjs` — unit tests for the pure reducer:
  x01 bust/double-out/checkout, cricket standard/cutthroat/noscore and
  the MPR rule, baseball innings/extras, undo/abandon semantics,
  serialize→deserialize round-trips, hardware-event idempotency keys.
- `tests/prodigy-parser.test.mjs` — protocol parser: CRLF buffering
  across frames, every observed line type, malformed input never throws.
- `tests/conformance.test.mjs` — replays `tests/fixtures/conformance.json`
  (games recorded from the **real UI** by the Playwright harness) through
  `packages/scoring-core` and asserts the winner and full per-player
  stats match byte-for-byte. This is the guarantee that the extracted
  reducer and the shipping play components implement identical rules.

**Per-change browser verification** — a Playwright harness (kept outside
the repo) that:

- runs the production build locally against a **mocked Supabase** —
  network interception serves canned auth/players/game_results responses,
  and a forged localStorage session skips login;
- drives real flows (score cricket turns, cast to a TV page over the
  `BroadcastChannel` transport, join by code, toggle display styles,
  reload mid-game and assert the live game restores) and asserts
  on-screen values (e.g. live MPR arithmetic);
- regenerates the conformance fixtures and captures the phone/tablet/TV
  screenshots used in the README.

The only path this can't exercise is production Supabase Realtime
websockets — that gets a manual smoke test after deploy.

## 15. Known limitations (accepted tradeoffs)

- Live game snapshots persist to `localStorage` (scoped to the signed-in
  account), so a phone reload mid-game restores the leg — but the
  snapshot is device-local: switching phones mid-game still loses it
  (server-side persistence arrives with the Prodigy sync work).
- Full-table reads on load (fine at league scale; see §7).
- One leg per match; double-out is trusted, not verified.
- Cast codes are 4 characters and channels are public: a guessed code can
  watch a scoreboard (read-only, no data access) — acceptable here.
- `public/` assets referenced by the layout (manifest, icons, logo.png)
  don't exist yet, so Android install prompts don't fire (ROADMAP #25).
- Multiplayer Elo updates winner-pairwise only.

## 16. How to extend

- **New game type**: build `PlayNewGame.js` honoring the §8 contract, add
  the option in `Setup.js`, register the view in `page.js` (three
  touchpoints), add a `GAME_NAMES` entry and `describe` case in
  `lib/summary.js`, add a stats bucket in `lib/stats.js` (competitive
  games only), and optionally a `TVScoreboard` view. No DB work. A new
  **drill** is the same minus the stats bucket, plus its id in
  `PRACTICE_ONLY` (`lib/practice.js`) and a metric in `computePractice`;
  publish its engine under `state` in `onProgress` and the generic TV
  view renders it.
- **New seasonal occasion**: one date check in `lib/occasions.js`, one
  particle layer/CSS block in `LoadingScreen.js`/`globals.css`.
- **Bigger items**: see [ROADMAP.md](ROADMAP.md).
- **Hardware (Prodigy D9000W)**: the plan to run Blackbird on the
  auto-scoring board itself — local-first SQLite event log, device-token
  ingestion via Vercel, private Realtime — is specified in
  [docs/prodigy-development-guide.md](docs/prodigy-development-guide.md).
  Its software-only track is **done**: `packages/scoring-core` is the
  pure event-sourced reducer (proven equivalent to the play components
  by the §14 conformance fixtures), `lib/prodigy/parser.js` speaks the
  board's protocol, `tools/` holds the capture/inventory scripts, and
  live games now survive reloads. The play components still run their
  own in-file engines for now — rewiring them onto scoring-core is
  deliberately deferred to the hardware-adapter phase, with the
  conformance suite guaranteeing the two stay in lockstep. Next steps
  need physical board access (SD clone + protocol capture).
