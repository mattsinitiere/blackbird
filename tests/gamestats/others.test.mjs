import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGame } from "../../lib/gamestats/index.js";

const M = { n: 0, mult: 0 };
const S = (n) => ({ n, mult: 1 });
const D = (n) => ({ n, mult: 2 });
const T = (n) => ({ n, mult: 3 });
const row = (gameType, stats, config = {}, winner = "Ann") => ({ username: "Ann", gameType, config, winner, stats });

test("around the clock: legacy replay corrects the 3-dart inflation and finds the hardest target", () => {
  // 1 hit, 2 hit, 3 miss miss | miss miss 3 | 4 5 6 | ... finish on bull with two extra darts logged afterwards
  const darts = [S(1), S(2), M, M, M, S(3), S(4), S(5), S(6), S(7), S(8), S(9), S(10), S(11), S(12), S(13), S(14), S(15), S(16), S(17), S(18), S(19), S(20), D(25), M, M];
  const a = analyzeGame(row("aroundTheClock", { dartsThrown: 27, targetsHit: 21, darts }));
  assert.equal(a.quality.legacy, true);
  assert.equal(a.metrics.finished, true);
  assert.equal(a.metrics.dartsToFinish, 24); // the two darts after the bull are ignored
  assert.equal(a.totals.dartsThrown, 24);
  assert.deepEqual(a.metrics.hardestTarget, { target: "3", darts: 4 });
  assert.equal(a.metrics.dartsPerTarget[0], 1);
  assert.equal(a.metrics.hitRate, 87.5);
});

test("killer: v2 events give darts to killer, kills and lives", () => {
  const events = [
    { t: "killer", by: "Ann", turn: 0 },
    { t: "hit", by: "Ann", on: "Bob", turn: 2 },
    { t: "hit", by: "Bob", on: "Ann", turn: 3 },
    { t: "hit", by: "Ann", on: "Bob", turn: 4 },
    { t: "elim", by: "Ann", on: "Bob", turn: 4 },
  ];
  const visits = [
    { i: 0, r: 0, s0: { l: 3, k: false }, darts: [M, D(5), S(20)], out: { l: 3, k: true, ev: 1 } },
    { i: 1, r: 1, s0: { l: 3, k: true }, darts: [D(7), S(1), M], out: { l: 3, k: true, ev: 1 } },
    { i: 2, r: 2, s0: { l: 2, k: true }, darts: [D(7), D(7), M], out: { l: 2, k: true, ev: 2 } },
  ];
  const a = analyzeGame(row("killer", { v: 2, dartsThrown: 9, livesRemaining: 2, isKiller: true, darts: visits.flatMap((v) => v.darts), visits, events }, { numbers: { Ann: 5, Bob: 7 }, lives: 3 }));
  assert.equal(a.metrics.dartsToBecomeKiller, 2);
  assert.equal(a.metrics.kills, 1);
  assert.equal(a.metrics.livesTaken, 2);
  assert.equal(a.metrics.livesLost, 1);
  assert.equal(a.metrics.eliminatedBy, null);
  assert.equal(a.metrics.doubleHitRate, 44.4);
  const legacy = analyzeGame(row("killer", { dartsThrown: 9, livesRemaining: 2, isKiller: true, darts: visits.flatMap((v) => v.darts) }, { numbers: { Ann: 5 } }));
  assert.equal(legacy.metrics.kills, null);
  assert.ok(legacy.quality.notes[0].includes("stats v2"));
});

test("shanghai: legacy rows replay rounds and detect the shanghai visit", () => {
  const darts = [S(1), M, M, S(2), D(2), T(2), M, M, M];
  const a = analyzeGame(row("shanghai", { totalScore: 13, roundScores: [1, 12, 0], dartsThrown: 9, shanghai: true, darts }, { mode: "beginner" }));
  assert.equal(a.rounds[1].shanghai, true);
  assert.equal(a.metrics.bestRound, 12);
  assert.equal(a.metrics.bestRoundAt, 2);
  assert.equal(a.metrics.hitRate, 44.4);
  assert.equal(a.metrics.shanghai, true);
});

test("halve it: legacy rows recover rounds, halvings and the trajectory exactly", () => {
  // 40 → round 20: S20 S20 M (+40=80) → round 19: M M M (halved → 40) → round 18: T18 (+54=94)
  const darts = [S(20), S(20), M, M, M, M, T(18), M, M];
  const a = analyzeGame(row("halveit", { finalScore: 94, halves: 1, dartsThrown: 9, darts }));
  assert.equal(a.quality.legacy, true);
  assert.deepEqual(a.metrics.roundScores, [40, 0, 54]);
  assert.deepEqual(a.metrics.halvedRounds, [1]);
  assert.deepEqual(a.metrics.trajectory, [80, 40, 94]);
  assert.equal(a.metrics.bestRound, 54);
  assert.equal(a.metrics.biggestHalving, 40);
  assert.equal(a.metrics.perTarget["19"].halved, true);
  assert.equal(a.rounds[3], undefined);
});

test("gotcha: busts and the winning visit replay from the log; resets make it approximate", () => {
  // target 100: S20 S20 S20 (60) | T20 (bust on the first dart: 120) | S20 S20 (100 → win)
  const darts = [S(20), S(20), S(20), T(20), S(20), S(20)];
  const a = analyzeGame(row("gotcha", { finalScore: 100, resetsDealt: 0, resetsReceived: 0, dartsThrown: 6, darts }, { targetScore: 100 }));
  assert.equal(a.metrics.busts, 1);
  assert.equal(a.rounds[1].bust, true);
  assert.equal(a.rounds[1].scored, 0);
  assert.deepEqual(a.metrics.trajectory, [60, 60, 100]);
  assert.equal(a.metrics.dartsToTarget, 6);
  assert.equal(a.metrics.bustRate, 33.3);
  const b = analyzeGame(row("gotcha", { finalScore: 100, resetsDealt: 0, resetsReceived: 1, dartsThrown: 6, darts }, { targetScore: 100 }));
  assert.ok(b.quality.notes[0].includes("approximate"));
  const v2 = analyzeGame(row("gotcha", { v: 2, finalScore: 100, resetsDealt: 1, resetsReceived: 0, dartsThrown: 3, darts: [S(20), S(20), S(20)], visits: [{ i: 0, r: 0, s0: 0, darts: [S(20), S(20), S(20)], out: { k: "normal", s: 60, sc: 60, reset: ["Bob"] } }], events: [{ t: "reset", by: "Ann", on: "Bob", turn: 0, from: 60 }] }, { targetScore: 100 }));
  assert.deepEqual(v2.metrics.resets, [{ on: "Bob", turn: 0, from: 60 }]);
});

test("tic-tac-toe: v2 boards, claims, cancels and the winning line", () => {
  const visits = [
    { i: 0, r: 0, s0: ".........", darts: [S(20), S(19), M], out: { b: "00.......", c: [0, 1], x: [] } },
    { i: 1, r: 1, s0: "00.1.....", darts: [S(17), S(18)], out: { b: "00.......", c: [], x: [3] } },
    { i: 2, r: 2, s0: "00.......", darts: [S(18)], out: { b: "000......", c: [2], x: [] } },
  ];
  const a = analyzeGame(row("tictactoe", { v: 2, squaresClaimed: 3, dartsThrown: 6, line: [0, 1, 2], darts: visits.flatMap((v) => v.darts), visits }));
  assert.equal(a.metrics.claimed, 3);
  assert.equal(a.metrics.cancelled, 1);
  assert.deepEqual(a.metrics.lineNumbers, [20, 19, 18]);
  assert.equal(a.metrics.dartsPerClaim, 2);
  assert.equal(a.metrics.missPct, 16.7);
});

test("bob's 27: rounds replay from the log with the bust round", () => {
  // D1 hit hit miss (+4 → 31), D2 miss miss miss (-4 → 27), D3 miss x3 (-6 → 21) ...
  const darts = [D(1), D(1), M, M, M, M, S(3), M, M];
  const a = analyzeGame(row("bobs27", { finalScore: 21, doublesHit: 2, roundsCompleted: 3, busted: false, dartsThrown: 9, darts }));
  assert.deepEqual(a.metrics.hitsByDouble, [2, 0, 0]);
  assert.deepEqual(a.rounds.map((r) => r.after), [31, 27, 21]);
  assert.equal(a.metrics.doubleHitRate, 22.2);
  assert.equal(a.metrics.missedRounds, 2);
  assert.equal(a.metrics.peakScore, 31);
});

test("checkout drill: finishes split into visits, by range", () => {
  // finish 1: 41 → S1 D20 (hit, 2 darts); finish 2: 100 → T20 T20 (bust) | S20 D20 (hit, 4 darts); finish 3: 60 → 9 misses
  const results = [{ target: 41, darts: 2, hit: true }, { target: 100, darts: 4, hit: true }, { target: 60, darts: 9, hit: false }];
  const darts = [S(1), D(20), T(20), T(20), S(20), D(20), M, M, M, M, M, M, M, M, M];
  const a = analyzeGame(row("checkoutDrill", { finishes: 3, hit: 2, dartsPerHit: 3, highestCheckout: 100, dartsThrown: 15, darts, results }, { count: 3 }));
  assert.equal(a.visits.length, 6); // 1 + 2 + 3
  assert.equal(a.visits[1].out.k, "bust");
  assert.equal(a.visits[5].out.k, "miss");
  assert.equal(a.metrics.busts, 1);
  assert.equal(a.metrics.hitRate, 66.7);
  assert.equal(a.metrics.byRange["41-70"].finishes, 2);
  assert.equal(a.metrics.byRange["71-100"].pct, 100);
  assert.equal(a.metrics.oneVisitFinishes, 1);
});

test("scoring drill: legacy numeric visits and v2 visitScores both work", () => {
  const darts = [T(20), S(20), M, S(20), S(20), S(20)];
  const legacy = analyzeGame(row("scoringDrill", { total: 140, turns: 2, avgPerTurn: 70, trebles: 1, onTarget: 5, hitRate: 83, bestVisit: 80, visits: [80, 60], dartsThrown: 6, darts }, { target: 20 }));
  assert.deepEqual(legacy.metrics.visitScores, [80, 60]);
  assert.equal(legacy.metrics.hitRate, 83.3);
  assert.equal(legacy.metrics.trebleRate, 16.7);
  const v2 = analyzeGame(row("scoringDrill", { v: 2, total: 140, turns: 2, avgPerTurn: 70, trebles: 1, onTarget: 5, hitRate: 83, bestVisit: 80, visitScores: [80, 60], dartsThrown: 6, darts, visits: [{ i: 0, r: 0, s0: 0, darts: darts.slice(0, 3), out: { s: 80 } }, { i: 1, r: 1, s0: 80, darts: darts.slice(3), out: { s: 60 } }] }, { target: 20 }));
  assert.equal(v2.quality.legacy, false);
  assert.equal(v2.metrics.worstVisit, 60);
});
