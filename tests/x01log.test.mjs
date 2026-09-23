import { test } from "node:test";
import assert from "node:assert/strict";
import { replayX01Log, isDoubleFinish, isSingleDartFinish, checkoutRange } from "../lib/x01log.js";

const T = (n) => ({ n, mult: 3 });
const D = (n) => ({ n, mult: 2 });
const S = (n) => ({ n, mult: 1 });

test("finish detection", () => {
  assert.equal(isDoubleFinish(32), true);
  assert.equal(isDoubleFinish(50), true);
  assert.equal(isDoubleFinish(33), false);
  assert.equal(isDoubleFinish(42), false);
  assert.equal(isSingleDartFinish(57), true); // T19
  assert.equal(isSingleDartFinish(59), false);
  assert.equal(isSingleDartFinish(61), false);
  assert.equal(checkoutRange(40), "2-40");
  assert.equal(checkoutRange(141), "101-170");
});

test("nine-darter: 501 double out, one chance, one hit", () => {
  const log = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];
  const r = replayX01Log(log, 501, true);
  assert.equal(r.valid, true);
  assert.equal(r.dartsThrown, 9);
  assert.equal(r.pointsScored, 501);
  assert.equal(r.one80s, 2);
  assert.equal(r.tons, 3);
  assert.equal(r.ton40s, 3);
  assert.equal(r.first9, 501);
  assert.equal(r.chances, 1);
  assert.equal(r.checkoutHit, 1);
  assert.equal(r.checkoutScore, 141);
  assert.equal(r.chancesByRange["101-170"], 1);
  assert.equal(r.threeDartAvg, 167);
});

test("busts and misses at a double count as chances, not hits", () => {
  // 32 left: S16 (chance, now 16), S16 (chance, hits zero on a single = bust)
  // then D16 (chance, hit)
  const log = [S(16), S(16), D(16)];
  const r = replayX01Log(log, 32, true);
  assert.equal(r.chances, 3);
  assert.equal(r.checkoutHit, 1);
  assert.equal(r.busts, 1);
  assert.equal(r.visits, 2);
  assert.equal(r.pointsScored, 32);
  assert.equal(r.checkoutScore, 32);
});

test("a bust restores the visit and a leg lost has no hit", () => {
  // 101 double out: T20 → 41, S20 → 21, S20 → 1 (bust: cannot finish on 1),
  // then S1 in an unfinished trailing visit
  const log = [T(20), S(20), S(20), S(1)];
  const r = replayX01Log(log, 101, true);
  assert.equal(r.busts, 1);
  assert.equal(r.checkoutHit, 0);
  assert.equal(r.pointsScored, 1);
  assert.equal(r.highestTurn, 1);
  assert.equal(r.visits, 2);
  assert.equal(r.chances, 0);
  assert.equal(r.first9, null);
});

test("straight out counts single-dart finishes", () => {
  const log = [T(20), T(19), S(20), S(3)]; // 140 → 80 → 23 → 3 → out on S3
  const r = replayX01Log(log, 140, false);
  assert.equal(r.checkoutHit, 1);
  assert.equal(r.checkoutScore, 3); // the finishing visit started on 3
  assert.equal(r.chances, 1); // only the dart thrown at 3; 23 is not a one-dart finish
});

test("legacy rows without a log are invalid but harmless", () => {
  assert.equal(replayX01Log(undefined, 501, true).valid, false);
  assert.equal(replayX01Log([], 501, true).valid, false);
});
