import { test } from "node:test";
import assert from "node:assert/strict";
import { halveItWinner } from "../lib/gamestats/halveit.js";
import { applyEloUpdate } from "../lib/stats.js";

test("halve it: highest score wins", () => {
  const players = ["A", "B", "C"];
  const state = { scores: { A: 80, B: 212, C: 95 }, halves: { A: 2, B: 1, C: 0 } };
  assert.equal(halveItWinner(players, state), "B");
});

test("halve it: a tie on score goes to fewer halvings, then throw order", () => {
  assert.equal(halveItWinner(["A", "B"], { scores: { A: 120, B: 120 }, halves: { A: 3, B: 1 } }), "B");
  assert.equal(halveItWinner(["A", "B"], { scores: { A: 120, B: 120 }, halves: { A: 1, B: 1 } }), "A");
});

test("elo: a game with no winner leaves ratings alone", () => {
  const before = { A: 1000, B: 1040 };
  assert.deepEqual(applyEloUpdate(before, ["A", "B"], undefined), before);
  assert.deepEqual(applyEloUpdate(before, ["A", "B"], "Z"), before);
});

test("elo: zero-sum between two players", () => {
  const after = applyEloUpdate({ A: 1000, B: 1000 }, ["A", "B"], "A");
  assert.equal(after.A + after.B, 2000);
  assert.ok(after.A > 1000);
});
