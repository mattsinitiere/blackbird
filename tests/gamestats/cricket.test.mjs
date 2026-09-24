import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGame } from "../../lib/gamestats/index.js";

const v2 = {
  username: "Ann", gameType: "cricket", config: { variant: "standard" }, winner: "Ann",
  stats: {
    v: 2, marks: 7, rounds: 3, roundMarks: [3, 1, 3], mpr: 2.33, pointsScored: 40, dartsThrown: 9,
    darts: [{ n: 20, mult: 3 }, { n: 0, mult: 0 }, { n: 5, mult: 1 }, { n: 19, mult: 1 }, { n: 0, mult: 0 }, { n: 0, mult: 0 }, { n: 19, mult: 2 }, { n: 20, mult: 2 }, { n: 0, mult: 0 }],
    visits: [
      { i: 0, r: 0, s0: { m: { 20: 0 }, p: 0 }, darts: [{ n: 20, mult: 3, x: { m: 3 } }, { n: 0, mult: 0, x: { m: 0 } }, { n: 5, mult: 1, x: { m: 0 } }], out: { marks: 3, pts: 0, dead: 0 } },
      { i: 1, r: 1, s0: { m: { 20: 3 }, p: 0 }, darts: [{ n: 19, mult: 1, x: { m: 1 } }, { n: 0, mult: 0, x: { m: 0 } }, { n: 0, mult: 0, x: { m: 0 } }], out: { marks: 1, pts: 0, dead: 0 } },
      { i: 2, r: 2, s0: { m: { 20: 3, 19: 1 }, p: 0 }, darts: [{ n: 19, mult: 2, x: { m: 2 } }, { n: 20, mult: 2, x: { m: 1 } }, { n: 0, mult: 0, x: { m: 0 } }], out: { marks: 3, pts: 40, dead: 1 } },
    ],
  },
};

test("v2 cricket: misses, per-number, closing order, dead darts", () => {
  const a = analyzeGame(v2);
  assert.equal(a.quality.hasMisses, true);
  assert.equal(a.totals.dartsThrown, 9);
  assert.equal(a.metrics.mpr, 2.33);
  assert.equal(a.metrics.missPct, 44.4); // 4 misses of 9
  assert.equal(a.metrics.hitRate, 44.4); // 4 darts on 20/19; the 5 is off target
  assert.equal(a.metrics.perNumber["20"].darts, 2);
  assert.equal(a.metrics.perNumber["20"].marks, 4);
  assert.equal(a.metrics.perNumber["20"].trebles, 1);
  assert.equal(a.metrics.perNumber["19"].hits, 3);
  assert.deepEqual(a.metrics.closingOrder, ["20", "19"]);
  assert.equal(a.metrics.roundsToClose["19"], 3);
  assert.equal(a.metrics.deadDarts, 1);
  assert.equal(a.metrics.bestRound, 3);
  assert.deepEqual(a.series.pointsPerRound.map((p) => p.y), [0, 0, 40]);
});

test("legacy cricket: rounds from roundMarks, estimated darts, no per-number", () => {
  const a = analyzeGame({ username: "Ann", gameType: "cricket", config: {}, winner: "Bob", stats: { marks: 9, rounds: 4, roundMarks: [3, 2, 2, 2], pointsScored: 0, darts: [{ n: 20, mult: 3 }] } });
  assert.equal(a.quality.legacy, true);
  assert.equal(a.totals.dartsThrown, 12);
  assert.equal(a.totals.dartsEstimated, true);
  assert.equal(a.metrics.perNumber, null);
  assert.equal(a.metrics.missPct, null);
  assert.equal(a.metrics.mpr, 2.25);
  assert.equal(a.rounds.length, 4);
  assert.ok(a.quality.notes[0].includes("misses"));
});
