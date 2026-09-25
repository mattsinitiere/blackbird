import { test } from "node:test";
import assert from "node:assert/strict";
import { cardStats } from "../lib/playerCard.js";

const base = { bestWinStreak: 0, x01: { games: 0 }, cricket: { games: 0 }, baseball: { games: 0 } };

test("a baseball and cricket player gets no X01 tiles and no dashes", () => {
  const s = { ...base, bestWinStreak: 3, cricket: { games: 3, mpr: 1.39, bestMpr: 1.92 }, baseball: { games: 24, avgRuns: 12.9 } };
  const t = cardStats(s);
  assert.deepEqual(t.map((x) => x.label), ["Cricket MPR", "Avg Runs", "Best MPR", "Best Streak", "Baseball Games", "Cricket Games"]);
  assert.ok(t.every((x) => x.value && x.value !== "—" && !x.value.includes("undefined")));
});

test("an X01 player leads with the 3-dart average", () => {
  const s = { ...base, x01: { games: 5, threeDartAvg: 52.3, highestTurn: 140, highestCheckout: 96, bestLeg: 21 } };
  const t = cardStats(s);
  assert.equal(t[0].label, "3-Dart Avg");
  assert.equal(t[0].value, "52.3");
  assert.ok(t.length <= 6 && t.length % 2 === 0);
});

test("few stats give an even, shorter grid; none gives none", () => {
  assert.equal(cardStats({ ...base, baseball: { games: 1, avgRuns: 9 } }).length, 2);
  assert.deepEqual(cardStats({ ...base }), []);
  assert.deepEqual(cardStats(null), []);
});
