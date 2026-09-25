# Training, coaching and scoped AI data (September 2026)

This covers training plans, Merlin, strategy hints, Alter Ego, the scoped AI
data layer, the fixed Luna configuration and the admin analytics. For Alter
Ego's calibration details see docs/ALTER_EGO.md.

## Setup

Apply these migrations in order in the Supabase SQL editor. Each one is
additive and safe to run twice. **All were applied to production on
2026-09-25**, together with `supabase/migration-search-paths.sql` (pins
`search_path` on the trigger functions, per the Supabase security linter).

1. `supabase/migration-scoped-data.sql`
   - indexes for the new query patterns;
   - a guard that stops a member from re-linking or renaming another
     account's player row.
2. `supabase/migration-ai-log.sql`
   - the `ai_request_log` table;
   - the `ai_log_request()` function.
3. `supabase/migration-training-plans.sql`
   - the `training_plans` and `plan_completions` tables;
   - the `create_training_plan()` function.

Environment variables (Vercel):

- `AI_PROVIDER=openai`
- `AI_MODEL`: blank or `gpt-6-luna`
- `AI_REASONING_EFFORT=none`
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`: already used by the admin panel, and now
  needed to save plans
- optional `AI_PRICE_INPUT_PER_1M` and `AI_PRICE_OUTPUT_PER_1M`, for the
  cost estimate in Admin → Analytics

Until the migrations are applied, the app still works:

- Practice says "Training plans aren't switched on for this app yet".
- Merlin falls back to its no-plan states.
- AI requests aren't logged.
- Analytics shows daily request counts only.

## Training plans

- **Limit.** Three saved plans per account, completed plans included.
  - Each plan takes one of three slots, and `unique (auth_id, slot)` is the
    hard guarantee.
  - `create_training_plan()` also takes a per-account advisory lock. Ten
    concurrent creates still produce exactly three plans (tested in
    `tests/sql/test_plans_race.sh`).
- **Idempotent creation.** `unique (auth_id, request_key)`: the browser
  generates the key once per draft, so a retried save returns the same
  plan. A failed or abandoned draft saves nothing and holds no slot.
- **Immutable.**
  - There is no UPDATE policy, update rights are revoked from members,
    and a trigger rejects every UPDATE, even from the service role.
  - To change a plan, delete it and create another.
  - Members can't insert plans directly: only the server, after
    validation, calls the creator.
- **Definition.** `lib/trainingPlans.js` validates it strictly:
  - Items can only be Checkout Drill (5/10/20), Scoring Drill (20/19/18/Bull ×
    5/10/20 turns), Bob's 27, Solo X01 (301/501/701, double or straight out),
    a bot match (unlocked bots only, X01 or Cricket) and Alter Ego (a
    window with enough history).
  - Invalid values are rejected, not snapped.
  - Size is bounded: 1–6 weeks, 1–5 sessions a week, at most 24 sessions,
    1–4 drills each, 12 KB.
  - Session minutes come from fixed per-drill estimates, never from the
    model.
- **Baseline.** Stored with the plan and recomputed on the server from the
  player's own rows. Every number carries its sample size, and numbers
  below `BASELINE_MIN` are null.
- **Starter assessment.** A fixed, clearly labelled plan offered when a
  player has fewer than 5 recorded games (`STARTER_MIN_GAMES`). It uses no
  AI call.
- **Progress.**
  - One `plan_completions` row per finished drill, written only after that
    game's result is saved (also after an offline sync).
  - Unique per (plan, session, drill) and per (plan, game), so replays
    never double-count.
  - The insert policy checks the plan is yours, the drill exists in the
    saved definition, and the game result is yours.
  - Opening a session records nothing.
- **Deleting a plan** removes its progress rows and frees the slot. Game
  results, stats and achievements are untouched; the games keep a minimal
  `config.plan` reference.
  - If a plan game is still being played on the device, it saves as
    ordinary practice and the summary says so.

### Creating a plan from Blackbird AI

- Asking the chat for a training plan gets a short answer plus a **Build
  This Plan** button (an actions block with `type: "plan"`).
  - `validateAction` in `lib/aiBlocks.js` allows only a known goal,
    minutes snapped to 15/30/45/60, 1–5 sessions a week and 1–6 weeks
    (capped at 24 sessions), and a note of up to 140 characters.
  - An unknown goal is dropped, so the form opens without drafting.
- The button opens Create With Merlin over the chat, pre-filled, and drafts
  at once through `/api/plans` (one AI request). The player can adjust,
  redraft or close; nothing is saved until **Save Plan**, which goes through
  the same server validation, idempotency and three-plan limit as Practice.
- Saved plans show a confirmation with **View in Practice**.
- The chat's data includes `trainingPlans` (count, titles, `canCreate`),
  read as the player. At the limit the model is told to say so rather than
  offer the button, and the modal shows the limit message regardless.
- The model never writes the sessions itself.

## Merlin (Home)

`lib/merlin.js` picks one state, in this order:

1. a session in progress (a game waiting on this device, or a part-done
   session);
2. the next session of the unfinished plan touched most recently;
3. plan complete;
4. not enough data;
5. new results;
6. no plan.

Everything is computed from saved records, and no AI call is made to show
the card:

- Comparisons ("since you started") need `BASELINE_MIN` samples on both
  sides.
- Observations need `OBSERVATION_MIN`: the last 5 X01 games against the
  10 before, a change of at least 3 average points, or at least 5
  checkout-percentage points with 15 or more chances each.
- Because nothing is cached, a corrected or deleted game can't leave a
  stale claim.
- Ask Merlin opens Blackbird AI with a question.

## Strategy hints

- **X01** (`lib/strategy/x01.js`):
  - Lists every legal finish for the score, the darts left (1–3) and the
    out rule (double or straight out, the only rules the app supports).
  - Ranks them with documented standard rules: fewest darts, then awkward
    setups, then the finishing-double order D20, D16, D8, D10… with the
    bull last, then robustness.
  - When no finish exists it recommends a **setup**, never a "checkout".
  - Known difference: the standard ranking prefers finishing on D20, so a
    few routes differ from the traditional chart (for example 76 →
    T12 D20, where the chart says T20 D8, which is shown as the alternative). Every route shown is legal.
- **Personalization** only uses darts with a known intended target:
  - Bob's 27 (the round's double; recorded as `a` from now on, and derived
    from the round for older v2 logs) and Scoring Drill darts.
  - Ordinary X01 darts have no recorded aim and are never treated as
    attempts.
  - A double is preferred over the standard one only with ≥ 30 attempts on
    both and when the Wilson 90% lower bound beats the standard double's
    upper bound (`lib/strategy/config.js`). Otherwise the preferred double
    (a setting) or the standard route is used, and labelled as such.
- **Cricket** (`lib/strategy/cricket.js`):
  - close what an opponent can score on;
  - score where you're closed and behind;
  - close the highest open number;
  - bull last.
  - Labelled "Standard strategy", with no probabilities.
- **Settings.** Settings → Gameplay: Hints Off / Standard / Personalized,
  and Preferred Double.
  - Hints never touch scores, turns or rules.
  - They're hidden on bot turns and not sent to the TV.

## Alter Ego

A practice opponent for X01, Cricket or Baseball built from the player's own
logged games (Cricket: marks per round; Baseball: runs per inning; see
docs/ALTER_EGO.md). Training-plan Alter Ego items remain X01 only. For X01:

- **Windows:** the last 10 eligible games, the last 30 days, or the
  previous calendar month.
- **Excluded:** games against Alter Ego itself.
- **Minimums:** 5 games, 150 scoring darts and 8 checkout darts.
- **Profile:**
  - Frozen into the game config when the match starts, and never
    recomputed mid-match or on resume.
  - Gameplay needs no network.
  - Practice only: no Elo, and off the bot ladder.

See docs/ALTER_EGO.md for the calibration method and tolerances.

## Blackbird AI data layer and model

See ARCHITECTURE.md "/api/insights". In short:

- **Identity** comes from the session, never the body.
- **Summary and tools** use targeted, paginated queries run as the user.
- **Coverage** is reported, and partial reads are labelled.
- **Model:**
  - Fixed Luna, with `reasoning_effort` always sent.
  - No silent parameter stripping and no fallback model.
  - Answer Style changes only a length instruction.
- **Logging:** requests are logged without content.

**Pagination limitations.**

- The keyset walk is not a database snapshot. A row synced late with an
  older timestamp can land behind the cursor during a walk; the as-of
  bound is recorded.
- Safety bounds: 60 pages, 20,000 rows, 9 seconds. Hitting one marks
  coverage `partial`.

## Admin → Analytics

Covers a period from 7 days to all time, bucketed in America/Chicago:

- accounts and sign-ups;
- active users (a visit event or a game);
- distinct games by mode, ranked and practice;
- AI requests, tokens, errors, fallbacks, summary-only answers and top
  users;
- cost, estimated only when prices are configured;
- training plans, completions and Alter Ego games.

It is read with the service role and aggregated in
`lib/adminAnalytics.js`.

## Tests

- `npm test`: unit tests, including 2,500-row pagination with a server cap
  below the page size, ties across page boundaries, partial coverage, DST,
  aggregate parity, plans, Merlin, strategy, Alter Ego calibration, model
  configuration and analytics.
- `npm run test:sql`: applies every migration to a throwaway local
  Postgres with a stubbed Supabase `auth` schema and checks:
  - the three-plan limit and a parallel creation race;
  - idempotency;
  - immutability;
  - cross-user isolation;
  - progress rules;
  - deletion;
  - the identity guard;
  - log ownership.
