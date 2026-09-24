import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGame, analyzeMatch, rowsFromMatch } from "../../lib/gamestats/index.js";
import { replayX01Visits } from "../../lib/x01log.js";

const T = (n) => ({ n, mult: 3 });
const D = (n) => ({ n, mult: 2 });
const S = (n) => ({ n, mult: 1 });
const M = { n: 0, mult: 0 };

// 301 double out, two legs. Leg 1 (won): T20 T20 T20 (180 → 121), T20 S20 S1 (bust: 121-101=20... no: 60+20+1=81 → 40), D20 out.
// Leg 2 (lost): S20 S20 S20 (60 → 241), M M M, then opponent finished.
const leg1 = [T(20), T(20), T(20), T(20), S(20), S(1), D(20)];
const leg2 = [S(20), S(20), S(20), M, M, M];
const v2Visits = [
  ...replayX01Visits(leg1, 301, true, 0).map((v, i) => ({ ...v, i })),
  ...replayX01Visits(leg2, 301, true, 1).map((v, i, arr) => ({ ...v, i: i + 3 })),
];
const v2Row = {
  gameId: "g1",
  username: "Ann",
  gameType: "x01",
  config: { startScore: 301, doubleOut: true, legs: 3 },
  winner: "Bob",
  result: "loss",
  stats: {
    v: 2,
    startedAt: "2026-09-24T19:00:00.000Z",
    durationMs: 300000,
    dartsThrown: 13,
    pointsScored: 301 + 60,
    highestTurn: 180,
    checkout: 0,
    darts: [...leg1, ...leg2],
    legs: [{ w: "Ann", d: 7, co: 40, s0: 301 }, { w: "Bob", d: 6, co: 0, s0: 301 }],
    visits: v2Visits,
  },
};

test("v2 best-of row: per-leg rounds, match totals and finishing", () => {
  const a = analyzeGame(v2Row);
  assert.equal(a.version, 2);
  assert.equal(a.quality.legacy, false);
  assert.equal(a.rounds.length, 2);
  assert.equal(a.rounds[0].won, true);
  assert.equal(a.rounds[0].darts, 7);
  assert.equal(a.rounds[0].checkout, 40);
  assert.equal(a.rounds[1].won, false);
  assert.equal(a.metrics.legsWon, 1);
  assert.equal(a.metrics.bestLeg, 7);
  assert.equal(a.metrics.avgDartsPerLeg, 6.5);
  assert.equal(a.metrics.one80s, 1);
  assert.equal(a.metrics.tons, 1);
  assert.equal(a.metrics.threeDartAvg, 83.3); // 361 points / 13 darts × 3
  assert.equal(a.metrics.checkoutChances, 1); // the D20 from 40
  assert.equal(a.metrics.checkoutHits, 1);
  assert.equal(a.metrics.checkoutPct, 100);
  assert.equal(a.metrics.missPct, 23.1); // 3 of 13
  assert.deepEqual(a.metrics.visitBuckets, { "0-39": 1, "40-59": 1, "60-99": 2, "100+": 1 }); // 0, 40 (the D20 finish), 81 + 60, 180
  assert.equal(a.totals.dartsThrown, 13);
  assert.equal(a.won, false);
  assert.equal(a.series.legAvg.length, 2);
});

test("legacy row replays visits and matches the v2 numbers for one leg", () => {
  const legacy = { ...v2Row, config: { startScore: 301, doubleOut: true }, winner: "Ann", stats: { dartsThrown: 7, pointsScored: 301, highestTurn: 180, checkout: 40, darts: leg1, dartPos: [{ sum: 100, count: 3 }, { sum: 80, count: 2 }, { sum: 121, count: 2 }] } };
  const a = analyzeGame(legacy);
  assert.equal(a.quality.legacy, true);
  assert.equal(a.quality.hasVisits, true);
  assert.equal(a.rounds.length, 1);
  assert.equal(a.metrics.bestLeg, 7);
  assert.equal(a.metrics.first9Avg, null); // fewer than nine darts
  assert.equal(a.metrics.checkoutPct, 100);
  assert.deepEqual(a.metrics.byPosition, [53.3, 40, 30.5]); // replayed from the log, same rule as the app's dartPos
  assert.equal(a.metrics.threeDartAvg, 129);
});

test("legacy row without a log keeps totals only", () => {
  const a = analyzeGame({ username: "Ann", gameType: "x01", config: { startScore: 501, doubleOut: true }, winner: "Ann", stats: { dartsThrown: 21, pointsScored: 501, highestTurn: 140, checkout: 32 } });
  assert.equal(a.quality.hasVisits, false);
  assert.ok(a.quality.notes[0].includes("no dart log"));
  assert.equal(a.metrics.threeDartAvg, 71.6);
  assert.equal(a.metrics.bestLeg, 21);
  assert.equal(a.metrics.checkoutPct, null);
  assert.equal(a.metrics.highestTurn, 140);
});

test("analyzeMatch and rowsFromMatch", () => {
  const match = { gameId: "m1", gameType: "x01", config: { startScore: 301, doubleOut: true }, players: ["Ann", "bot:rook"], winner: "Ann", completedAt: "2026-09-24T19:05:00.000Z", perPlayer: { Ann: v2Row.stats, "bot:rook": {} } };
  const rows = rowsFromMatch(match);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].opponents, ["bot:rook"]);
  const m = analyzeMatch(rows);
  assert.equal(m.winner, "Ann");
  assert.equal(m.players.Ann.won, true);
  assert.equal(analyzeMatch([]), null);
});
