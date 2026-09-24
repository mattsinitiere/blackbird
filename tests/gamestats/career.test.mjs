import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCareer } from "../../lib/gamestats/career.js";
import { computeRecords } from "../../lib/gamestats/records.js";

const T = (n) => ({ n, mult: 3 });
const D = (n) => ({ n, mult: 2 });
const S = (n) => ({ n, mult: 1 });
const M = { n: 0, mult: 0 };
let id = 0;
const row = (gameType, winner, stats, config = {}, me = "Ann", result) => ({ id: ++id, gameId: `g${id}`, username: me, gameType, config, winner, result: result || (winner === me ? "win" : "loss"), opponents: ["Bob"], stats, eloAfter: 1000, completedAt: `2026-09-${String(10 + id).padStart(2, "0")}T20:00:00Z` });

const results = [
  row("x01", "Ann", { dartsThrown: 9, pointsScored: 501, highestTurn: 180, checkout: 141, darts: [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)] }, { startScore: 501, doubleOut: true }),
  row("x01", "Bob", { dartsThrown: 6, pointsScored: 100, highestTurn: 60 }, { startScore: 501, doubleOut: true }), // legacy, no log
  row("cricket", "Ann", { v: 2, marks: 6, rounds: 2, roundMarks: [3, 3], pointsScored: 0, dartsThrown: 6, darts: [T(20), M, M, T(19), M, M], visits: [
    { i: 0, r: 0, s0: { m: {}, p: 0 }, darts: [{ ...T(20), x: { m: 3 } }, { ...M, x: { m: 0 } }, { ...M, x: { m: 0 } }], out: { marks: 3, pts: 0, dead: 0 } },
    { i: 1, r: 1, s0: { m: {}, p: 0 }, darts: [{ ...T(19), x: { m: 3 } }, { ...M, x: { m: 0 } }, { ...M, x: { m: 0 } }], out: { marks: 3, pts: 0, dead: 0 } },
  ] }),
  row("cricket", "Ann", { marks: 10, rounds: 5, roundMarks: [2, 2, 2, 2, 2], pointsScored: 20 }), // legacy
  row("baseball", "Ann", { runs: 4, darts: [S(1), S(1), M, D(2), M, M] }),
];
const practice = [
  row("bobs27", "Ann", { finalScore: 45, doublesHit: 12, roundsCompleted: 21, busted: false, dartsThrown: 63, darts: [] }, {}, "Ann", "practice"),
  row("checkoutDrill", "Ann", { finishes: 5, hit: 3, dartsPerHit: 4, highestCheckout: 100, dartsThrown: 30, darts: [], results: [{ target: 41, darts: 3, hit: true }, { target: 100, darts: 6, hit: true }, { target: 60, darts: 9, hit: false }, { target: 50, darts: 3, hit: true }, { target: 120, darts: 9, hit: false }] }, { count: 5 }, "Ann", "practice"),
];

test("computeCareer: x01 combines v2 and legacy rows with coverage", () => {
  const c = computeCareer({ results, practice }, "Ann");
  assert.equal(c.x01.games, 2);
  assert.equal(c.x01.wins, 1);
  assert.equal(c.x01.coverage.withVisits, 1);
  assert.equal(c.x01.threeDartAvg, 120.2); // 601 points / 15 darts × 3
  assert.equal(c.x01.checkoutPct, 100);
  assert.equal(c.x01.checkoutChances, 1);
  assert.equal(c.x01.one80s, 2);
  assert.equal(c.x01.highestCheckout, 141);
  assert.equal(c.x01.bestLeg, 9);
  assert.equal(c.x01.series.avg.length, 2);
  assert.equal(c.x01.checkoutByRange["101-170"].pct, 100);
});

test("computeCareer: cricket per-number only from logged games; other games present", () => {
  const c = computeCareer({ results, practice }, "Ann");
  assert.equal(c.cricket.games, 2);
  assert.equal(c.cricket.mpr, 2.29); // 16 marks / 7 rounds
  assert.equal(c.cricket.missPct, 66.7); // 4 of 6 logged darts
  assert.equal(c.cricket.perNumber["20"].darts, 1);
  assert.equal(c.cricket.perNumber["19"].trebles, 1);
  assert.deepEqual(c.cricket.favouriteOpener, { number: "20", games: 1 });
  assert.equal(c.baseball.avgRuns, 4);
  assert.deepEqual(c.baseball.hitsBy, { S: 2, D: 1, T: 0, miss: 3 });
  assert.equal(c.bobs27.sessions, 1);
  assert.equal(c.bobs27.cleanRuns, 1);
  assert.equal(c.checkoutDrill.hitRate, 60);
  assert.equal(c.checkoutDrill.byRange["41-70"].hits, 2);
  assert.equal(c.aroundTheClock, undefined);
});

test("computeRecords: one holder per category across games and drills", () => {
  const recs = computeRecords({ results, practice });
  const byId = Object.fromEntries(recs.map((r) => [r.id, r]));
  assert.equal(byId.x01_high_turn.value, 180);
  assert.equal(byId.x01_high_checkout.value, 141);
  assert.equal(byId.x01_best_leg.display, "9d");
  assert.equal(byId.x01_most_180s.value, 2);
  assert.equal(byId.cricket_best_mpr.value, 2); // the 3.0 game had only 2 rounds, below the 3-round floor
  assert.equal(byId.cricket_fastest_close.value, 2); // the v2 game was won in 2 rounds
  assert.equal(byId.baseball_biggest_inning.value, 2);
  assert.equal(byId.bobs27_high.value, 45);
  assert.equal(byId.checkout_best_rate.display, "60%");
  assert.equal(byId.clock_fewest_darts, undefined);
  assert.ok(recs.every((r) => r.holder === "Ann"));
});
