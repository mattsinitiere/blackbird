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

import { rematchGame } from "../lib/games.js";

test("rematch: same order by default, rotated on request", () => {
  const g = { id: "a", gameType: "x01", players: ["A", "B", "C"], config: { startScore: 501 } };
  assert.deepEqual(rematchGame(g).players, ["A", "B", "C"]);
  assert.deepEqual(rematchGame(g, { rotate: true }).players, ["B", "C", "A"]);
  assert.notEqual(rematchGame(g).id, undefined);
  const k = rematchGame({ id: "k", gameType: "killer", players: ["A", "B"], config: {} }, { rotate: true });
  assert.deepEqual(Object.keys(k.config.numbers).sort(), ["A", "B"]);
});

import { undoDepth, dartsAfterUndo } from "../lib/undo.js";

test("undo: skips bot visits back to the last person's visit", () => {
  const isBot = (u) => u.startsWith("bot:");
  const players = ["me", "bot:raven"];
  const history = [{ turn: 0 }, { turn: 1 }, { turn: 2 }, { turn: 3 }];
  assert.equal(undoDepth(history, players, isBot), 2); // pop the bot's visit and my last one
  assert.equal(undoDepth(history.slice(0, 3), players, isBot), 1);
  assert.equal(undoDepth([{ turn: 1 }], players, isBot), 0); // only a bot visit to undo
  assert.equal(undoDepth([], players, isBot), 0);
});

test("undo: a committed visit comes back minus its last dart", () => {
  assert.deepEqual(dartsAfterUndo([{ n: 20 }, { n: 20 }, { n: 5 }]), [{ n: 20 }, { n: 20 }]);
  assert.deepEqual(dartsAfterUndo(undefined), []);
});
