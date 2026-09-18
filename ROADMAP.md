# Blackbird — Improvement Roadmap + TV Scoreboard Mode

## Context

Blackbird (Next.js 14 + Supabase on Vercel) now has X01/Cricket/Baseball scoring, MPR tracking with per-round history, Elo, profiles/charts, AI insights, a branded splash, and a home activity chart. The user wants (a) a long-form roadmap of further improvements — games, analytics, features — and (b) a "cast to TV" experience: game details displayed large on a TV while the phone keeps a simplified scoring UI.

Key architectural facts that shape everything below:
- Every play component already fires `onProgress(<entire game state as JSON>)` on each change — a ready-made live feed for a TV view.
- `game_results.stats` is free-form JSONB per player per game, so new games and new metrics need **no SQL migrations**.
- New game types plug in via a small contract: Setup builds `{id, gameType, players, config}`; the play component calls `onFinish({id, gameType, config, players, winner, perPlayer, completedAt})`; `lib/stats.js` needs a bucket per game type.
- `@supabase/supabase-js` v2 is installed → Realtime broadcast channels available with no new dependencies.

---

## Part 1 — TV Scoreboard Mode ("cast to TV")

### The honest AirPlay story
A web app cannot natively drive AirPlay with a different UI than the phone (AirPlay mirroring would just clone the phone screen). The standard solution — used by dart apps like DartConnect — is a **TV web page**: any browser on the TV opens the app's `/tv` page, pairs with a room code, and renders a big live scoreboard synced in real time. The phone keeps scoring with its own (simplified) UI. This achieves exactly the requested split-experience and needs no native app.

Per the user, all three setups must work (they all do, since it's just a URL):
- **Apple TV / AirPlay**: AirPlay a Mac Safari window showing `/tv`, or mirror an iPad parked on the TV. (Direct iPhone mirroring is the fallback — it clones the phone UI, still usable.)
- **Smart TV browser**: open the Vercel URL + `/tv` in the TV's built-in browser; the pairing code keeps typing to 4 characters.
- **Chromecast tab-cast**: cast a Chrome tab showing `/tv` from any laptop.
The `/tv` page will show these three one-line instructions on its idle screen.

### Architecture

**Sync mechanism — Supabase Realtime broadcast channels** (already available: `@supabase/supabase-js` v2 is installed; no new dependencies, no schema changes, no table writes).
- The phone is the publisher. `page.js`'s `saveProgress` callback already receives the **entire live game state on every change** from all three play components — hook the broadcast there, throttled (~200 ms), with the unbounded `history` array stripped from the payload.
- Channel name: `cast:<CODE>` where CODE is a 4-character room code (unambiguous alphabet, e.g. `ACDEFHJKMNPRTWXY34679`) generated on the phone.
- Message events: `state` (game meta + snapshot), `finished` (winner), `ended` (quit). The TV sends `hello` when it subscribes; the phone answers with the current snapshot from its `liveProgress` ref — this solves late joins/reconnects since broadcast is transient.
- Security posture: public broadcast channel keyed by the room code. Worst case someone guessing a code sees a live scoreboard — acceptable for a friends-league app, and the TV never gets write access to anything. The TV page therefore **does not require sign-in**.

**Transport abstraction for testability — `lib/cast.js` (~80 lines)**
- `createCastPublisher(code)` → `{send(event, payload), close()}` and `createCastSubscriber(code, handlers)` → `{close()}`.
- Two transports behind the same interface: Supabase Realtime (production) and the browser `BroadcastChannel` API (used when a `NEXT_PUBLIC_CAST_TRANSPORT=local` env or `?local=1` flag is set) — this lets the existing Playwright + mock-Supabase harness test phone↔TV sync in one browser with two pages, since real Realtime websockets can't connect to the mocked backend.
- Handles `supabase === null`, resubscribe on disconnect, and cleanup.

**Pairing UX**
- Phone: a "Cast" button rendered by `page.js` above the live game (visible on all three play views), using a **flat single-color vector TV/cast SVG icon** in the same style as the existing `GearIcon` in `components/ui.js` — **no emojis anywhere in the UI** (this is a standing design rule for all roadmap items: icons are inline single-color SVG shapes using `currentColor`, like the gear and back-chevron already in `ui.js` and the one-color dartboard splash spinner). Tapping Cast generates the code and shows it as a chip ("TV code: ABCD"); tap again to stop casting. Code persists for the session so reconnects rejoin.
- TV: `/tv` idle screen shows the Blackbird wordmark, a large 4-character code input (plain text input — TV browsers pop their own keyboards), and the three one-line setup instructions (AirPlay / smart TV browser / tab-cast). Enter code → waiting screen → live scoreboard as soon as a `state` event arrives.

**Routing & components**
- `app/tv/page.js` (~120 lines) — standalone `"use client"` page, no auth gate, no app shell/nav; connection state machine: `enter-code → waiting → live → winner/ended`.
- `components/tv/TVScoreboard.js` (~250 lines total incl. per-game views) — dispatches on `gameType`:
  - **Cricket**: full-width marks grid (reuse the `cricket-table` markup/symbols from PlayCricket), points, **live MPR**, round number, current player highlighted, last turn's darts.
  - **X01**: giant remaining score per player (vw-based typography), whose throw, darts this turn, live 3-dart average, last turn score.
  - **Baseball**: the box score table writ large, current inning/target.
- `app/globals.css` — a `.tv` scope (~100 lines): vw-based type sizes, dark-leaning default, high-contrast; independent of the phone `--fs` preference.
- Winner screen: big winner name + final stats; `ended` → back to idle with the same code active.

**Simplified phone UI while casting**
- Play components get a `castActive` prop: when true, the scoreboard table and DartBoard collapse (the TV is now the scoreboard) leaving big entry controls — ring selector, target chips, End turn/Undo. ~20 lines per play component, purely conditional rendering; scoring logic untouched.

**Edge cases**: hide the Cast button when `supabase` is null; close channels on quit/finish/unmount; multiple TVs on one code just work (broadcast fan-out); a phone page refresh restores the live game from localStorage (item #24, done in v1.4).

**Scope estimate**: ~550–650 new lines. No SQL, no new dependencies.

**Files to touch**: `lib/cast.js` (new), `app/tv/page.js` (new), `components/tv/TVScoreboard.js` (new), `app/page.js` (cast state + button + publisher hookup in `saveProgress`), `components/PlayCricket.js` / `PlayX01.js` / `PlayBaseball.js` (`castActive` collapse), `app/globals.css` (`.tv` styles), README + screenshots.

---

## Part 2 — Roadmap of further improvements

**Standing design rule (applies to everything below): no emojis in the UI.** All iconography is flat, single-color inline SVG shapes (`currentColor` / theme tokens), matching the existing `GearIcon`, back chevron, and one-color dartboard spinner. Items below that mention avatars/celebrations/icons follow this rule.

### A. New games (each ~1 play component + Setup option + stats bucket)
1. **Around the Clock** — hit 1→20→Bull in order; stats: darts taken, hit rate.
2. **Killer** — each player owns a number, build to killer, knock others out.
3. **Shanghai** — 7 rounds on 1–7 (or 20s down), single+double+triple in one turn = instant "Shanghai" win.
4. **Halve-It** — hit the round's target or your score halves; great party game.
5. **Gotcha / exact-score race** — race to exact total; landing on someone's score resets them.
6. **Tic-Tac-Toe darts** — 3×3 grid of targets, close a square by hitting it; team-friendly.
7. **Legs/Sets for X01** — best-of-N legs, sets, alternating bull-off for the start; brings league-format matches (currently one leg per match).
8. **Doubles/Teams support** — 2v2 with combined team stats (schema: `players` stays individuals; `config.teams` array).

### B. Analytics & stats
9. **Checkout suggestions in X01** — show the standard out-chart path (e.g. 170 → T20 T20 Bull) when remaining ≤ 170; pure lookup table, huge quality-of-life.
10. **Checkout success rate** — attempts vs hits on doubles (needs per-dart intent or infer from remaining ≤ 50 + double-out).
11. **First-9-darts average** (X01) — standard pro metric, computable from existing `dartPos`/log data retroactively.
12. **Heatmap of hits** — aggregate `darts` logs onto the DartBoard SVG per player (already stores every dart's `{n, mult}`).
13. **Cricket number strengths** — MPR per target (20s vs 19s vs bull) from cricket dart logs.
14. **Streaks & records board** — win streaks, best MPR game, highest checkout, most 180s; a "Records" tab or Home section.
15. **Per-session summaries** — group games by night; "Tuesday league night: 9 games, Matt +32 Elo".
16. **Elo history & rankings movement** — arrows on the leaderboard (▲2 this week), already have per-game `elo_after`.
17. **Form indicator** — last-5-games W/L dots next to names on the leaderboard.
18. **CSV/JSON export** — download your `game_results` from the Account screen.

### C. Live-game experience
19. **TV scoreboard mode** (Part 1).
20. **180 / high-score celebrations** — full-screen flash + optional sound on 180s, checkouts, closing cricket.
21. **Sounds & haptics** — dart thock, bust buzz; `navigator.vibrate` on phones; per-user toggle in Account.
22. **Voice caller** — Web Speech API announces "Scores 140!" like a match caller; works well with the TV mode.
23. **Turn timer** (optional) — shot clock for league nights.
24. **Resume across reload** — **done (v1.4)**: live games persist to localStorage (scoped per account) and restore after a page refresh; Supabase-side persistence comes with the Prodigy sync work.

### D. Product/platform
25. **PWA completion** — the manifest/icons referenced in `app/layout.js` don't exist (`public/` is missing): add `public/manifest.webmanifest` + icons + `logo.png` so Android install works; optional service worker for offline shell.
26. **Season support** — season start/end dates; leaderboards and stats filterable per season; archive winners.
27. **Tournaments** — bracket generator from the player list, auto-advance winners, bracket view on the TV mode.
28. **Player avatars** — a per-player accent color plus a flat single-color vector mark (initials in a circle, or a small pick-list of simple SVG shapes); stored in a JSONB `meta` column on `players`. No emojis.
29. **Notifications** — "Sam just beat your best MPR" via web push (needs service worker from #25).
30. **Multi-league support** — `leagues` table + membership; RLS scoping per league (bigger lift; only if the app grows beyond one friend group).
31. **Match photos/notes** — attach a note or photo to a game night (Supabase Storage).
32. **Native tvOS app** — for browserless Apple TVs: a SwiftUI app that
   subscribes to the same Supabase Realtime cast channel and renders the
   scoreboard natively (tvOS has no browser/web view, so this is the only
   no-second-device option). Needs an Apple Developer account and
   TestFlight/App Store distribution. Until then: AirPlay-mirror an
   iPad/iPhone/Mac showing /tv, or add a cheap Fire TV/Chromecast stick.
33. **Undo/edit past games (admin)** — admin route already exists; add "delete/fix a game_result" action with Elo replay (replay logic exists in `stats.js: replayMatchesToResults`).

### E. AI insights upgrades
33. **Post-game AI recap** — one-tap "summarize tonight" using existing insights route.
34. **Coaching tips** — feed per-target cricket accuracy + checkout rates for personalized practice suggestions.
35. **Trash talk generator** — pre-match hype line for the TV screen before a game starts (fits TV mode idle screen).

## Part 3 — Prodigy D9000W hardware integration

The full plan lives in **[docs/prodigy-development-guide.md](docs/prodigy-development-guide.md)**
(v1.0, Aug 2026): boot Blackbird directly on the Escalade Prodigy D9000W's
own Linux/Qt system, keep the vendor's camera location engine, score games
locally with no phone or internet, and sync every event exactly once to
Vercel/Supabase when online. Summary of its delivery phases:

- **Phase 0 — preservation & inventory** (hardware): clone/hash Board A's
  SD card, identify init system, services, display stack, architecture.
  *Tooling ready (v1.4): `tools/prodigy-inspect.sh` produces the read-only
  inventory report answering the guide's §36 unknowns — needs the board.*
- **Phase 1 — read-only protocol logger**: capture the board's
  port-9001 WebSocket protocol (`Dart:`, `Reset:`, `Clarity:`, `Metadata:`)
  with a passive logger; build firmware-pinned fixtures.
  *Tooling ready (v1.4): `tools/prodigy-logger.mjs` (passive capture) and
  `lib/prodigy/parser.js` with unit tests — needs the board on the LAN.*
- **Phase 2 — scoring-core refactor** (pure software, can start now):
  extract the X01/cricket/baseball rules into a pure event-sourced reducer
  package shared by manual UI, hardware input, and replay; make live web
  games recoverable across reloads.
  *Done (v1.4): `packages/scoring-core` ships the pure reducer, proven
  equivalent to the play components by app-captured conformance fixtures
  (`npm test`), and live games now survive page reloads. The play
  components keep their in-file engines until the hardware-adapter phase;
  the conformance suite keeps the two in lockstep.*
- **Phase 3 — board daemon + SQLite**: local event log, outbox,
  snapshots, IPC; survives power loss.
- **Phase 4 — on-board Qt/QML UI**: full-screen HDMI scorer that boots
  instead of the vendor UI, with factory fallback.
- **Phase 5 — cloud sync**: device-token auth, Vercel ingestion route,
  ownership-based Supabase schema/RLS, private Realtime, idempotent
  finalization + Elo.
- **Phase 6 — hardening**: power/network failure suites, cert pinning,
  signed updates, Board B comparison.

The guide's §36 lists 20 unknowns that must be read off the real SD card
before any board installation; nothing is flashed until those are resolved.

### Suggested build order (rough)
Per the user, this is a **planning document only for now** — nothing gets built until they pick items from it. Recommended sequence when they do:
1. TV scoreboard mode (Part 1) — the headline feature.
2. Checkout suggestions (#9) + celebrations (#20) — big fun-per-line-of-code.
3. PWA completion (#25) — small, fixes real gaps.
4. X01 legs/sets (#7) + first-9 average (#11).
5. Records board (#14) + leaderboard form dots (#17).
6. New games starting with Around the Clock (#1) and Shanghai (#3).

---

## Verification (for the TV mode, when built)

1. **Automated (existing harness)**: extend the Playwright + mock-Supabase scripts in the session scratchpad — launch two pages in one browser context with the `BroadcastChannel` local transport: page A signs in, starts a cricket game, taps Cast, reads the code; page B opens `/tv`, enters the code; assert the TV shows the players, then throw turns on A and assert marks/MPR/round update on B; finish the game and assert the winner screen. Screenshot the TV views at 1920×1080 for the README.
2. **Real-transport smoke test**: after deploy, open the production `/tv` on a laptop and the app on a phone, pair, and play a few turns over actual Supabase Realtime (checks the prod websocket path the local transport can't).
3. **Regression**: run the existing verify scripts (home, profile, cricket flow) to confirm the `castActive` prop changes nothing when casting is off; `npm run build` must stay clean.

---

## Planning log — September 2026: from friends-league app to a service

Decisions and analysis from the September 2026 planning sessions. This
section is the source of truth for the "make Blackbird a real service"
direction; earlier sections above stay as the feature backlog.

### Where the app stands (v1.6)

- Nine game types plus three practice drills, TV cast, Elo, profiles,
  records, matchup predictor, PWA, end-of-game summary mirrored on the
  TV, @handles, a practice log, and an eight-bot ladder for X01, Cricket
  and Baseball.
- **Single-tenant by construction.** One `players` table, one
  `game_results` table, RLS says any signed-in user can read everything
  and update any player. Anyone who signs up joins *the* league. The
  admin is a hardcoded email shipped in the client bundle. Sharing the
  app with strangers requires the identity/visibility work below first.

### Decisions taken

- **Leagues are deferred.** The social model is **accounts + friends**:
  one player profile per account, mutual friend requests, friends can
  see each other's full stats and pick each other for games. Leagues
  (membership, league-only standings, seasons) come later on top.
- **Profiles are social-media style**: `@handle` (globally unique),
  display name, avatar (colour + initial now, photo later via Supabase
  Storage), bio, home town/bar. Private by default; a public-profile
  toggle later.
- **Elo stays one personal rating per player** across all rated games.
  Per-league Elo only if leagues ask for it.
- **Sign-in: Apple, Google, and email** via Supabase Auth. Email gets
  password reset (missing today) and confirmation turned back on. Apple
  needs the paid developer program and only becomes mandatory when a
  native iOS app offers other social logins, so launch web with Google +
  email first.
- **Practice and bot games never touch competitive averages or Elo.**
  They save as `practice` and feed a separate practice section.
- **Domain**: blackbird.com is taken. Checked available (Sept 2026):
  blackbirddarts.com / .app / .io, blackbird-darts.com, playblackbird.com
  / .app, getblackbird.app, blackbirdscoring.com. Recommendation:
  register blackbirddarts.com + .app, run on .com, redirect .app.
- **Premium**: free core, paid tier ~$3.99–4.99/mo with an annual option
  (~$29.99–34.99) pushed hardest, web billing via Stripe. Founding-league
  members are grandfathered to Premium for life.

### Single-player modes — done (v1.6)

Shipped as planned, with two deliberate deviations: the bottom bot
averages 32 rather than 30 (a Gaussian thrower cannot average 30 at T20
without missing the board outright), and the ladder keeps a per-bot
W–L record plus "highest bot beaten" instead of a separate bot rating,
until there is data to tune one. Premium gating is not built (there is
no entitlement system yet); the full ladder is free.

1. **Save practice games** (`result = 'practice'`, excluded from Elo and
   standings; Practice section on the profile with trends and PBs).
2. **Bot ladder, chess.com style**: 8–10 named bots at fixed 3-dart
   averages (~30 → 100+), each with avatar and personality. Simulator
   aims at a target and samples the landing point with a level-scaled
   error radius mapped through the dartboard geometry, so a weak bot
   going for T20 lands in 1 and 5 like a human; checkout knowledge scales
   with level. Each bot calibrated by a Monte Carlo test in the suite.
   Separate bot rating + record per bot; beat one to unlock the next.
   Cricket bots use the same model with a cricket strategy. Free: 2–3
   bots; Premium: full ladder.
3. **Drills as game types** (one file each + a `lib/summary.js` case):
   Bob's 27, checkout challenge (random 41–170 finishes, darts to
   finish), scoring drill (N turns at 20s, per-dart accuracy). Around the
   Clock and Shanghai already exist and just need saving.
4. **Practice dashboard**: PBs per drill, weekly practice count, trends.

### Free vs Premium (proposed)

| | Free | Premium |
|---|---|---|
| Games | X01, Cricket, Baseball, Around the Clock | All modes + drills |
| Bot opponent | 2 levels | Full ladder |
| Friends | Unlimited | Unlimited |
| Leagues (later) | Join any, create 1 (≤8 players) | Unlimited, seasons, schedules |
| Stats | Averages, win %, MPR, Elo, 30-day trends | Per-dart, checkout %, number heatmaps, full history, export |
| TV cast, practice saving | Yes | Yes |

Rules: never gate the core scoring loop or TV cast (that is what spreads
the app); enforce entitlements in RLS/server, not only in the UI; keep
billing web-only (an App Store build must use Apple IAP, 15–30 % cut).

### Costs and pricing math

- One-time/yearly: domain ~$35/yr; Apple Developer Program $99/yr (defer
  until the iOS app); Google OAuth free; Stripe free (per-transaction).
- Monthly floor: Vercel Pro already paid per seat (Blackbird adds $0);
  Supabase Free until a few hundred active users (pauses only after 7
  idle days; 200 Realtime connections), then Pro $25/mo; transactional
  email free at Resend's tier (Supabase's built-in auth mailer is
  rate-limited to a handful/hour); Sentry free.
  → **cheap floor ≈ domain + Claude plan**; full production floor
  ≈ $55–75/mo; $100–200/mo at ~10k MAU.
- Stripe nets ~$4.50 of $4.99 or ~$3.55 of $3.99. Freemium converts
  2–5 %: 1,000 MAU → 20–50 subs → $90–225/mo. ~15 subs cover servers.
  Price by market, not cost; expect hobby-scale revenue until several
  thousand users.
- Development = the owner's Claude plan; remaining scope ≈ 11–15 working
  sessions (a freelancer would quote 150–300 h).

### App Store path

No rewrite. In order of effort: (1) stay a PWA (installable, no store,
iOS supports web push); (2) wrap with Capacitor — same code, both stores,
but Apple rejects thin wrappers, so add push, haptics, Sign in with
Apple, offline, share sheet (~2–3 sessions, needs a Mac/Xcode; Google
Play accepts a PWA wrapper for a one-time $25); (3) React Native rewrite
— not worth it. Recommendation: PWA now, Capacitor once demand is proven.

### Market positioning

Pros and serious leagues already run DartConnect; the top end is moving
to camera auto-scoring (Scolia); DartCounter has millions of consumer
users; Nakka n01 is the free X01 tracker. **Do not pitch pros.** The
market is the group at the bar: amateur league players and hobby groups.
Differentiators: TV mode with no hardware, group Elo/matchup/night
summaries, party games (Killer, Gotcha, Halve It, Tic-Tac-Toe), no ads,
and later hardware input. Pitches: hobby — "score any game, see who's
really best, put it on the TV"; league — "league-night stats, MPR,
checkouts and Elo without the subscription." Go-to-market: QR on the bar
wall pointing at the TV mode, league organisers, r/Darts once profiles
and the bot exist. Don't build online play vs strangers yet.

### Sequence

| Step | Work | Sessions |
|---|---|---|
| 1 | Save practice, practice section on profile | done |
| 2 | Handles, profiles, friends, RLS rewrite (own rows + friends' rows), scoped fetching, migration | 2–3 |
| 3 | Apple/Google/email, password reset, landing page, terms + privacy, admin email out of the client bundle | 1–2 |
| 4 | Friend invites, QR, share sheet | 1 |
| 5 | Bot ladder (+ drills, practice hub) | done |
| 6 | Stripe Premium, entitlements, grandfathering | 2 |
| 7 | Monitoring, Supabase Pro, email provider | 1 |
| Later | Leagues | 3–4 |

Owner's side in parallel: buy the domain, Google OAuth client, Stripe
account; Apple Developer Program when the iOS app is in reach.

### Hardware: auto-scoring for any steel-tip board

**Goal**: a premium retrofit that works on any wall-mounted bristle board
and sells at a margin that recoups development in a small number of
units.

**What exists**: Autodarts (3 webcams on printed mounts, Pi/Linux, ~$150
DIY, free software), Scolia (~$600 + subscription), Target Omni (~$400).
The Prodigy D9000W ($1,000) is *also* a camera system: two cameras,
**infrared illumination**, a vibration trigger, and triangulation — the
IR is lighting, not a sensor. Nobody has made a non-camera sensor resolve
an 8 mm treble ring; cameras are the only approach that ships.

**Design**: Pi 5 + three IR-capable camera modules with IR-pass filters +
850 nm LED ring + printed ring that clamps a 451 mm board (with or
without a surround; cabinets excluded — say so on the box) + auto-
calibration from the board image (people rotate boards). Speak the same
event protocol as the Prodigy bridge so one parser and
`packages/scoring-core` serve both.

**Trigger lesson from the Prodigy**: loud music makes it log misses with
no dart thrown — bass through the wall trips the vibration sensor, the
cameras see no new dart, and it concludes "bounce-out". The manual admits
stomping does the same. Rules for our rig: vibration may only *wake* the
cameras, never create an event; nothing scores unless a camera sees a
new dart; a miss registers only when a dart was seen arriving and not
sticking (or trigger on frame differencing and drop the sensor, as
Autodarts does). If a piezo stays: high-pass + noise-floor-tracking
threshold, optionally a second sensor on the wall to subtract room
vibration. "Works with the music on" goes on the box.
Mitigations for the Prodigy itself: isolate the board from the wall
(rubber pads, not the speaker wall, subwoofer off the floor); when
Blackbird runs on the board, never auto-commit a board-reported miss —
"music mode" toggle, on by default: board scores hits, players tap Miss.

**Unit economics** (single-unit part prices): BOM ≈ $255 (Pi 5 8 GB $80,
3 cameras $75, IR LEDs + driver $20, piezo/cables $25, PSU + SD $25,
printed parts/enclosure $30). Per unit at $599 / $699: packaging +
shipping $40, payment fees $18/$21, warranty reserve 5 %, ~2 h assembly
$50 → contribution ≈ $205 / $300. A $5k development spend recoups at
~17–25 units. Price ceiling is set by Scolia/Omni/Autodarts; the edges
are IR (works in the dark), no subscription, no phone required, any
wall-mounted board.

**Plan**: (1) prototype ~$300, 2–3 months part-time, Python/OpenCV on
the Pi (board detection → calibration, differencing on trigger, tip
localisation, 3-camera voting, segment map); (2) the gate: 500 throws,
≥98 % correct segments, no enclosure work before this passes; (3) five
beta units on friends' boards; (4) batch of 25, sold as a **kit** first
(lower regulatory, assembly and return exposure). Before any sale: a
patent read on Escalade's two-camera/IR/vibration claims, and FCC
responsibility for a finished product with custom LED boards.

**Order**: finish the Prodigy bridge first (zero new hardware, proves the
whole board→app pipeline, and its parser/event contract is exactly what
the homebrew rig plugs into); the camera rig is an experiment against
that contract; sell only after the gate and the betas. The app roadmap
continues in parallel — the rig is only worth $699 if the software on
the TV is worth watching.
