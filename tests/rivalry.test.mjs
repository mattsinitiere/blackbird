import { test } from "node:test";
import assert from "node:assert/strict";
import { rivalry } from "../lib/stats.js";
import { buildMySummary } from "../lib/aiSummary.js";
import { computeStats } from "../lib/stats.js";
import { finishPlaces } from "../lib/summary.js";
import { buildResultRows } from "../lib/practice.js";

let seq = 0;
function row(gameType, winner, opponents, date, extra = {}) {
  seq++;
  return {
    gameId: `g${seq}`,
    username: "Matthew",
    gameType,
    config: {},
    winner,
    result: winner === "Matthew" ? "win" : "loss",
    opponents,
    stats: {},
    eloAfter: 1000,
    completedAt: date,
    ...extra,
  };
}

// baseball and cricket against Chuck, one three-way game Gracie won, one
// practice game that must not count, and a game without Chuck
const results = [
  row("baseball", "Chuck", ["Chuck"], "2026-06-13T20:00:00Z"),
  row("baseball", "Matthew", ["Chuck"], "2026-06-14T20:00:00Z"),
  row("baseball", "Gracie", ["Chuck", "Gracie"], "2026-06-15T20:00:00Z"),
  row("cricket", "Matthew", ["Chuck"], "2026-07-28T20:00:00Z"),
  row("cricket", "Chuck", ["Chuck"], "2026-09-18T20:00:00Z"),
  row("cricket", "Chuck", ["Chuck"], "2026-09-18T21:00:00Z"),
  row("x01", "Matthew", ["Chuck"], "2026-09-19T21:00:00Z", { result: "practice" }),
  row("x01", "Matthew", ["Gracie"], "2026-09-20T21:00:00Z"),
  // someone else's row never counts toward Matthew's record
  { ...row("baseball", "Chuck", ["Matthew"], "2026-06-13T20:00:00Z"), username: "Chuck", result: "win" },
];

test("rivalry: overall and per game mode, third-player wins apart", () => {
  const r = rivalry(results, "Matthew", "Chuck");
  assert.equal(r.games, 6);
  assert.equal(r.wins, 2);
  assert.equal(r.losses, 3);
  assert.equal(r.otherWinner, 1);
  assert.deepEqual(r.byGameType.baseball, { games: 3, wins: 1, losses: 1, otherWinner: 1 });
  assert.deepEqual(r.byGameType.cricket, { games: 3, wins: 1, losses: 2, otherWinner: 0 });
  assert.equal(r.byGameType.x01, undefined, "practice is never ranked");
  assert.deepEqual(r.streak, { result: "L", count: 2 });
  assert.equal(r.last5.length, 5);
  assert.equal(r.last5[0].date, "2026-09-18T21:00:00Z");
  assert.equal(r.firstPlayed, "2026-06-13T20:00:00Z");
});

test("rivalry: streak skips games a third player won", () => {
  const rows = [
    row("baseball", "Matthew", ["Chuck"], "2026-01-01T00:00:00Z"),
    row("baseball", "Gracie", ["Chuck", "Gracie"], "2026-01-02T00:00:00Z"),
    row("baseball", "Matthew", ["Chuck"], "2026-01-03T00:00:00Z"),
  ];
  assert.deepEqual(rivalry(rows, "Matthew", "Chuck").streak, { result: "W", count: 2 });
});

test("rivalry: nobody played gives an empty record, not an error", () => {
  const r = rivalry(results, "Matthew", "Nobody");
  assert.equal(r.games, 0);
  assert.equal(r.winPct, null);
  assert.equal(r.streak, null);
  assert.deepEqual(r.last5, []);
});

test("AI summary answers 'my W/L vs chuck' with handles and a mode split", () => {
  const ranked = results.filter((r) => r.result !== "practice");
  const players = [
    { username: "Matthew", handle: "matthew" },
    { username: "Chuck", handle: "chuck" },
    { username: "Gracie", handle: "gracie" },
  ];
  const s = buildMySummary({ me: "Matthew", stats: computeStats(ranked), elo: {}, results: ranked, practice: [], players, now: new Date("2026-09-24T00:00:00Z") });
  const chuck = s.headToHead.find((h) => h.handle === "chuck");
  assert.ok(chuck);
  assert.equal(chuck.opponent, "Chuck");
  assert.equal(`${chuck.wins}-${chuck.losses}`, "2-3");
  assert.equal(chuck.byGameType.cricket.losses, 2);
  assert.ok(s.roster.some((p) => p.name === "Chuck" && p.handle === "chuck"));
});

test("finishPlaces: winner first, the rest by score, tied losers get no place", () => {
  const places = finishPlaces({
    gameType: "baseball",
    players: ["A", "B", "C", "D"],
    winner: "C",
    perPlayer: { A: { runs: 4 }, B: { runs: 9 }, C: { runs: 12 }, D: { runs: 4 } },
  });
  assert.deepEqual(places, { C: 1, B: 2, A: null, D: null });
});

test("finishPlaces: cutthroat cricket ranks the lowest points higher", () => {
  const places = finishPlaces({
    gameType: "cricket",
    config: { variant: "cutthroat" },
    players: ["A", "B", "C"],
    winner: "A",
    perPlayer: { A: { pointsScored: 0 }, B: { pointsScored: 60 }, C: { pointsScored: 20 } },
  });
  assert.deepEqual(places, { A: 1, C: 2, B: 3 });
});

test("buildResultRows stores the place on each row's stats, and nothing when not given", () => {
  const base = { gameId: "x", gameType: "baseball", config: {}, players: ["A", "B"], winner: "A", perPlayer: { A: { runs: 5 }, B: { runs: 2 } }, ranked: true, eloAfter: { A: 1010, B: 990 }, completedAt: "2026-09-24T00:00:00Z" };
  const withPlaces = buildResultRows({ ...base, places: { A: 1, B: 2 } });
  assert.deepEqual(withPlaces.map((r) => r.stats.place), [1, 2]);
  assert.equal(withPlaces[0].stats.runs, 5);
  const tied = buildResultRows({ ...base, places: { A: 1, B: null } });
  assert.equal(tied[1].stats.place, undefined, "an unknown place is not stored");
  const without = buildResultRows(base);
  assert.equal(without[0].stats.place, undefined);
});
