# Analytics & stats review — September 2026

Prompted by Blackbird AI failing to answer "what's my W/L vs Chuck?". This
covers what each game saves, what the app derives from it, why that question
failed, and what changed.

## Short answer

**The data to answer it was already there.** Every `game_results` row stores
`winner` and `opponents`, so any head-to-head record can be computed exactly.
The production database had 27 ranked games between Matthew and Chuck on
2026-09-24: Baseball 9–13 (two more won by a third player in multiplayer
games) and Cricket 1–2, so **10–15 in games one of you won, 27 played**.

The failure was in what the AI received:

- `headToHead` only reached the AI payload on 2026-09-23 (`abe2e84`). A
  question asked before that deploy had no rivalry data at all.
- After that, it was one overall line per opponent: no split by game mode,
  and multiplayer games won by someone else were counted in `games` but in
  neither `wins` nor `losses`, without explanation.
- There was no roster of names and @handles, so the model had to guess that
  "chuck" meant `Chuck`.
- The model reads one large JSON blob and does the arithmetic itself. Small
  or free models (Groq Llama, Gemini Flash) do this badly even when the data
  is present. The provider is set by `AI_PROVIDER` on Vercel. It wasn't
  checked here, because that means reading environment values.

## What each game saves (production, 283 rows / 138 games)

| Mode     | Rows | Stored per player                                   | Full visit log | Timing |
|----------|------|-----------------------------------------------------|----------------|--------|
| Baseball | 194  | `darts, runs`                                       | darts only     | no     |
| Cricket  | 78   | `darts, marks, mpr, pointsScored, roundMarks, rounds` | darts only   | no     |
| X01      | 11   | `darts, visits, dartsThrown, pointsScored, highestTurn, checkout, dartPos, durationMs, startedAt, finalScore, v` | 1 row (v2) | 1 row |

Before the shared recorder (`ebc3af5`, this week), only X01 saved stats v2
(visits, legs, timing). The recorder now writes full visit logs and timing
for every mode, but no game had been played on it at review time, so it is
still unverified in production. **Older rows can't be backfilled**: the
visit-level detail was never recorded.

## Derived, not captured (and that's fine)

Win/loss, win %, streaks, form, Elo history (`eloAfter` on every row),
head-to-head, per-mode career numbers (`lib/gamestats/career.js`), 3-dart
average, MPR and achievements are all computed from the rows above. None
needed new capture.

## Real gaps

1. **Finishing order in multiplayer games.** Only the winner was stored, so
   2nd/3rd place had to be re-derived from each player's stats (23
   multiplayer baseball rows). **Fixed going forward:** each row now saves
   `stats.place` (`finishPlaces` in `lib/summary.js`, written by
   `recordGame`). Losers whose scores tie (every knocked-out Killer player
   ends on 0 lives) get no place rather than a guess. Old rows stay
   without it, and the profile shows "Lost" rather than guessing.
2. **Timing and visit logs for non-X01 games before the recorder.** Can't be
   fixed after the fact.

## Changes in this pass

- `rivalry(results, me, opp)` in `lib/stats.js`: record overall and per game
  mode, third-player wins kept separate, streak, last five meetings, first
  and last played. Tested in `tests/rivalry.test.mjs`.
- AI payload (`lib/aiSummary.js`): each `headToHead` entry carries
  `byGameType`, `otherWinner`, `streak`, `last5` and `handle`. New `roster`
  (names and @handles) and `definitions.headToHead`. The prompt
  (`app/api/insights/route.js`) says how to match a name or handle and how
  to report a record by mode.
- In the app, without the AI: another player's profile opens with a
  **You vs {name}** card (overall and per mode), and your own profile's
  circle shows your W–L with each person you follow.

## Recommended next steps

- Play one game of each mode and check the saved row has `visits`,
  `startedAt`, `durationMs` and `place` (confirms the recorder in
  production).
- If the AI still fumbles records, answer common questions ("record vs X",
  "best game", "form") in the app with deterministic cards, and let the AI
  explain them rather than compute them.
- Consider a stronger model for Blackbird AI if a free tier is configured.
