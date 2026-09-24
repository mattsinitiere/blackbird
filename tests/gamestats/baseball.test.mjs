import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGame } from "../../lib/gamestats/index.js";

const M = { n: 0, mult: 0 };
const darts = [
  { n: 1, mult: 1 }, { n: 1, mult: 1 }, M, // inning 1: 2
  M, M, M, // inning 2: 0
  { n: 3, mult: 3 }, { n: 3, mult: 2 }, M, // inning 3: 5
];

test("legacy baseball is rebuilt exactly from the log", () => {
  const a = analyzeGame({ username: "Ann", gameType: "baseball", config: {}, winner: "Ann", stats: { runs: 7, darts } });
  assert.equal(a.quality.legacy, true);
  assert.equal(a.quality.hasVisits, true);
  assert.deepEqual(a.rounds.map((r) => r.runs), [2, 0, 5]);
  assert.deepEqual(a.rounds.map((r) => r.target), [1, 2, 3]);
  assert.equal(a.metrics.biggestInning, 5);
  assert.equal(a.metrics.biggestInningAt, 3);
  assert.equal(a.metrics.scorelessInnings, 1);
  assert.deepEqual(a.metrics.hitsBy, { S: 2, D: 1, T: 1, miss: 5 });
  assert.equal(a.metrics.hitRate, 44.4);
  assert.equal(a.quality.exactLanding, false);
});

test("v2 baseball uses stored innings and visits", () => {
  const a = analyzeGame({ username: "Ann", gameType: "baseball", config: {}, winner: "Ann", stats: { v: 2, runs: 7, innings: [2, 0, 5], dartsThrown: 9, darts, durationMs: 90000, visits: [
    { i: 0, r: 0, s0: 0, darts: darts.slice(0, 3), out: { runs: 2 } },
    { i: 1, r: 1, s0: 2, darts: darts.slice(3, 6), out: { runs: 0 } },
    { i: 2, r: 2, s0: 2, darts: darts.slice(6, 9), out: { runs: 5 } },
  ] } });
  assert.equal(a.quality.legacy, false);
  assert.equal(a.metrics.avgRunsPerInning, 2.33);
  assert.equal(a.metrics.extraInnings, 0);
  assert.equal(a.series.runsPerInning.length, 3);
});
