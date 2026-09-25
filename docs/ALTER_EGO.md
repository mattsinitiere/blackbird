# Alter Ego

A practice opponent for **X01, Cricket and Baseball** that plays **roughly
like the player's own recent form** in that game. It is not AI-driven and not a copy of the player: the player's logged
darts are boiled down to two numbers, each of which becomes a landing error
(sigma, mm) for the same throw simulator the ladder bots use.

Code: `lib/alterEgo.js` (pure: no React, no network, deterministic).
Tests: `tests/alterEgo.test.mjs`.

## Data used

- Only the requesting player's own `game_results` rows (`username === me`,
  in-memory shape from `lib/practice.js` `resultFromRow`) with
  `gameType === "x01"`.
- Only `row.stats` (the row owner's per-player block) and `row.config`
  (`startScore`, `doubleOut`). Opponents' darts are never stored in a
  player's row, and no other row is read, so another player's or a bot's
  darts cannot enter.
- A row needs a usable dart log:
  - stats v2: `stats.v >= 2` and a non-empty `stats.visits` array
    (`{ i, r, s0, darts, out }`, see `lib/recorder.js`), or
  - legacy: a flat `stats.darts` log, replayed with
    `replayX01Visits(darts, config.startScore, config.doubleOut)`
    (`lib/x01log.js`).
  Rows without a log are skipped but counted in `coverage.rowsWithoutLogs`.

## Eligibility and exclusions

| Row | Used? |
| --- | --- |
| Own X01, solo, vs humans, or vs a ladder bot | yes (it is real throwing) |
| `opponents` includes `bot:alterego`, or `config.alterEgo` set | **no** (no feedback loop) |
| Another player's row | no |
| Non-X01 game types | no |
| No usable dart log / unparseable `completedAt` | no (coverage only) |

## Windows

All windows run on the eligible rows and return them oldest first, with
`from`/`to` = ISO timestamps of the first and last included row.

| Id | Label | Rule |
| --- | --- | --- |
| `last10` | Last 10 eligible games | newest 10 eligible rows with `completedAt <= now` |
| `last30d` | Last 30 days | `now - 30×24h <= completedAt <= now` (boundary inclusive) |
| `prevMonth` | Previous calendar month | rows whose year-month **in the timezone** (default `America/Chicago`) is the month before `now`'s |

The month is computed with `Intl.DateTimeFormat(…, { timeZone })`, so DST
changes inside the month (tested with November 2025 in Chicago) and year
rollover (January → previous December) are handled without offset math.

## Thresholds

`ALTER_EGO_MIN = { games: 5, scoringDarts: 150, checkoutChances: 8 }`,
overridable per call: `buildProfile(rows, { min: { … } })`. When the window
falls short, `buildProfile` returns
`{ ok: false, reason, have, need, coverage }` with `reason` one of
`not-enough-games`, `not-enough-scoring-darts`, `not-enough-checkout-chances`
(first failing check). Note: at typical club level a 501 leg has ~25 scoring
darts, so 150 scoring darts usually needs 6–7 games, not 5.

## What is measured

- **Scoring average**: over every visit that *starts* above 100 remaining,
  points ÷ darts × 3. Bust visits count their darts and score 0 — only when
  the log marks the visit `out.k === "bust"` (v2) or the replay rules make it
  a bust (legacy), the same convention as `summarizeX01Visits`.
- **Checkout dart rate**: checkouts hit ÷ checkout chances, where a chance is
  a dart thrown while the remaining score is a one-dart double finish (2–40
  even, or 50), exactly as in `lib/x01log.js`. Only **double-out** games
  contribute, because the finishing model is double hitting; straight-out
  games contribute scoring darts only.

## Calibration

Both fits use seeded Monte Carlo with common random numbers
(`mulberry32(1234)`, 20 000 darts, `throwAt` from `lib/simulator.js`) and 30
bisection steps over sigma ∈ [3, 120] mm; results are rounded to 0.01 mm and
memoized (scoring per 0.1 of average, doubles per 0.001 of rate).

- `sigmaForScoringAvg(avg)`: sigma whose simulated T20 3-dart average equals
  `avg`. Averages above the 3 mm ceiling (~158) clamp to 3; below the
  120 mm floor (~19) clamp to 120.
- `sigmaForDoubleRate(rate)`: sigma whose simulated hit rate on the
  *intended* double equals `rate`, aiming D16 and D20 alternately. `rate` is
  clamped to [0.01, 0.95]; anything above ~0.82 (the rate at 3 mm) clamps
  to 3 mm.

Reference points: avg 30 → 61.9 mm, 45 → 24.9, 60 → 16.5, 75 → 12.5,
90 → 9.7; rate 0.10 → 23.2 mm, 0.25 → 12.2, 0.40 → 7.6. These agree with
the ladder bots' fitted sigmas in `lib/bots.js`.

### Tolerances

Test (`calibration fit`): for scoring averages {30, 45, 60, 75, 90} ×
checkout rates {0.10, 0.25, 0.40}, a fresh bot simulated with an
independent seed:

| Check | Required | Achieved (worst case) |
| --- | --- | --- |
| 5 000 visits (15 000 darts) at T20, 3-dart avg | ±3 | ±0.55 |
| 5 000 double attempts (D16/D20), hit rate | ±0.05 | ±0.007 |

A synthetic player with true sigma 18 mm (simulated 501 legs via
`pickX01Target`) gets a fitted `sigmaScoring` within ±6 mm of 18; the gap
is expected because visits starting at 101–170 include setup shots.

## The bot

`alterEgoBot(profile)` →
`{ id: "bot:alterego", name: "Alter Ego", level: 0, avg, sigma, sigmaFinish, checkout: 1, color, blurb }`.

`checkout: 1` means it always knows the right out-shot; its finishing skill
lives entirely in `sigmaFinish`. `throwForAlterEgo(bot, target, remaining,
doubleOut, rng)` uses `sigmaFinish` when the dart is a **checkout attempt**,
otherwise `sigma`:

> the target is a double (incl. inner bull) AND either the double finishes
> exactly (`remaining === value(target)`) or, in double-out, `remaining` is
> itself a one-dart double finish (2–40 even, or 50).

So a setup bull from 110 or T20 from 60 uses the scoring sigma.
`remaining` is the score left before this dart (PlayX01's `remaining`,
which already subtracts earlier darts in the visit).

## Freezing and resume

At game start store `frozenConfig(profile)` in `game.config.alterEgo`:
`{ v, window, from, to, games, scoringDarts, checkoutChances, scoringAvg,
checkoutDartRate, sigmaScoring, sigmaFinish }`. On resume call
`botFromConfig(game.config.alterEgo)`: it uses the stored sigmas verbatim
and never re-derives from data, so the opponent cannot change mid-game or
between sessions. It returns `null` for a missing or corrupt snapshot.
`config.alterEgo` also marks the game for exclusion from future profiles.

## Limitations

- It does not reconstruct physical mechanics or the player's real aim
  dispersion: scoring logs record landings, not intent, so only a single
  isotropic scoring sigma is fitted from the average.
- The simulator is an isotropic Gaussian around the bed center: no
  vertical/horizontal bias, no favorite-miss (e.g. 5 vs 1) pattern, no
  grouping.
- Logs lack intended targets, so finishing is modeled from checkout-chance
  darts (hits ÷ chances) and mapped to a generic D16/D20 hit rate. Players
  who finish mostly on the bull or small doubles will be approximated.
- It does not model tiredness, pressure, match situation or streaks, and
  setup-shot accuracy in 41–170 uses the scoring sigma.
- Small windows are noisy; the thresholds only guarantee a minimum.

## Cricket and Baseball

Chosen with the X01 / Cricket / Baseball chips on the Alter Ego card in
Practice. The same windows, exclusions (games against Alter Ego, other
players, other modes) and freezing rules apply as for X01.

- **Measured.** One number per mode, from the stats every saved game
  already has (no dart log needed):
  - Cricket: marks per round, `Σ marks ÷ Σ rounds`, the MPR the app shows.
    Standard and no-score games both count; marks already exclude dead darts.
  - Baseball: runs per inning, `Σ runs ÷ Σ innings`.
- **Thresholds** (`ALTER_EGO_MIN_ROUNDS`): 5 games and 50 rounds (innings),
  about 150 darts. Below that the card says what is missing.
- **Calibration.** Seeded Monte Carlo bisection to one sigma, as for X01:
  - Cricket (`sigmaForCricketMPR`) plays **whole simulated standard legs**
    of the Alter Ego against itself with the ladder bots' strategy
    (`pickCricketTarget`) and PlayCricket's MPR rule, so the marks a real
    game wastes on closed numbers are part of the fit. 12 bisection steps
    (~0.03 mm), about 0.2 s per fit.
  - Baseball (`sigmaForBaseballRPI`) aims at the triple of numbers 1–9, the
    same aim the Baseball bots use (`pickBaseballTarget`).
- **Tolerances** (tests, independent seed): Cricket MPR within ±0.1 for
  targets 0.8–3.4; Baseball runs per inning within ±0.1 for 0.8–5.
- **Frozen config**: `{ v, mode, window, from, to, games, rounds, perRound,
  sigma }`. A config without `mode` is X01 (every game saved before this).
- **Play**: PlayCricket and PlayBaseball rebuild the bot from the frozen
  config and throw with the existing bot code. Results are practice (a bot
  is in the game), with the frozen config kept on the saved result.

Caveats, stated on the card too:

- The Alter Ego matches the *rate*; its choices are the bots' standard
  strategy, not the player's. A player who, say, chases points early will
  see a different game shape at the same MPR.
- Every Cricket number (and the bull) is treated as equally hard, and one
  sigma covers everything: no favorite numbers, no bull specialists.
- The self-play fit assumes an evenly matched opponent; against a much
  stronger or weaker player the in-game MPR shifts a little, because more or
  fewer marks land on numbers the opponent has already closed.

## Versioning

`ALTER_EGO_VERSION = 1`, stored as `v` in the frozen config. Bump it when the
measurement, eligibility or calibration method changes; old games keep
their frozen sigmas and replay unchanged.
