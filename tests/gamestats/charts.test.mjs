import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeGame } from "../../lib/gamestats/index.js";
import { applyTicTacToeVisit, ticTacToeWinner } from "../../lib/gamestats/tictactoe.js";
import { raceLegs, shortBarLabel } from "../../lib/gamestats/common.js";

const M = { n: 0, mult: 0 };
const S = (n) => ({ n, mult: 1 });

test("killer: the lives chart follows every round, and keeps players knocked out early", () => {
  // Ann, Bob, Cat throw in that order. Bob hits Ann in round 1, Ann takes
  // Bob out in round 2 (turn 3) and Cat in round 3 (turn 6)
  const events = [
    { t: "killer", by: "Ann", turn: 0 },
    { t: "hit", by: "Bob", on: "Ann", turn: 1 },
    { t: "hit", by: "Ann", on: "Bob", turn: 3 },
    { t: "hit", by: "Ann", on: "Bob", turn: 3 },
    { t: "hit", by: "Ann", on: "Bob", turn: 3 },
    { t: "elim", by: "Ann", on: "Bob", turn: 3 },
    { t: "hit", by: "Ann", on: "Cat", turn: 6 },
    { t: "hit", by: "Ann", on: "Cat", turn: 6 },
    { t: "hit", by: "Ann", on: "Cat", turn: 6 },
    { t: "elim", by: "Ann", on: "Cat", turn: 6 },
  ];
  const cfg = { numbers: { Ann: 5, Bob: 7, Cat: 9 }, lives: 3 };
  const one = (u, visits, evs = events) => analyzeGame({ username: u, gameType: "killer", config: cfg, winner: "Ann", stats: { v: 2, visits, events: evs } });
  const v = (r) => ({ i: r, r, s0: {}, darts: [M, M, M], out: {} });
  const bob = one("Bob", [v(0)]).series.lives;
  assert.deepEqual(bob.map((p) => p.y), [3, 3, 0], "one visit of his own, still charted down to 0");
  assert.equal(bob[0].label, "Start");
  assert.equal(bob[2].label, "Round 2");
  assert.deepEqual(one("Cat", [v(0), v(1)]).series.lives.map((p) => p.y), [3, 3, 3, 0]);
  assert.deepEqual(one("Ann", [v(0), v(1), v(2)]).series.lives.map((p) => p.y), [3, 2, 2, 2]);
  // rows with no event log fall back to the player's own visits
  assert.deepEqual(one("Ann", [{ ...v(0), out: { l: 2 } }, { ...v(1), out: { l: 1 } }], []).series.lives.map((p) => p.y), [2, 1]);
});

test("tic-tac-toe: claims, cancels and a line completed mid-visit", () => {
  const b = Array(9).fill(null);
  b[0] = "Bob";
  b[1] = "Ann";
  const out = applyTicTacToeVisit(b, "Ann", [S(20), S(1), S(18)]);
  assert.deepEqual(out.claimed, [2]);
  assert.deepEqual(out.cancelled, [0]);
  assert.equal(out.board[0], null);
  assert.equal(out.won, null);
  assert.equal(b[0], "Bob", "the board passed in is untouched");
  const line = applyTicTacToeVisit(out.board, "Ann", [S(20), M]);
  assert.deepEqual(line.won, { winner: "Ann", line: [0, 1, 2] });
  assert.equal(ticTacToeWinner(Array(9).fill(null)), null);
  assert.deepEqual(applyTicTacToeVisit(b, "Ann", [S(19)]).claimed, [], "own square: no effect");
});

test("match chart helpers: X01 race split by leg, short bar labels", () => {
  const pts = [{ y: 121, label: "L1" }, { y: 0, label: "L1" }, { y: 180, label: "L2" }, { y: null, label: "L2" }, { y: 0, label: "L2" }];
  assert.deepEqual(raceLegs(pts).map((l) => l.map((p) => p.y)), [[121, 0], [180, 0]]);
  assert.equal(raceLegs([{ y: 5 }]).length, 1);
  assert.equal(shortBarLabel("Inning 3"), "3");
  assert.equal(shortBarLabel("Extra 1"), "E1");
  assert.equal(shortBarLabel("Bull"), "Bull");
});
