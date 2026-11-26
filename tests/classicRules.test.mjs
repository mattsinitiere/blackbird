import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCricketVisit, blankCricketPlayer, canEndTurn, cricketClosedNotWinning, cricketWinner, END_TURN_GUARD_MS } from "../lib/cricket.js";
import { baseballAfterVisit, baseballContenders } from "../lib/baseball.js";
import { x01VisitOutcome, checkoutConfirmation, CHECKOUT_AUTO_CONFIRM_MS } from "../lib/x01log.js";

// ---------- cricket ----------

const T = (target) => ({ target, ring: target === "B" ? 2 : 3 });
const S = (target) => ({ target, ring: 1 });
const MISS = { target: "M", ring: 0 };

/** Play visits [player, darts] in order; returns the state and the winner, if any. */
function playCricket(players, variant, visits) {
  const ns = Object.fromEntries(players.map((u) => [u, blankCricketPlayer()]));
  let winner = null;
  for (const [cur, darts] of visits) {
    assert.equal(winner, null, `${cur} threw after the game ended`);
    applyCricketVisit(ns, cur, darts, { players, variant });
    winner = cricketWinner(ns, { players, variant, cur });
  }
  return { ns, winner };
}

test("cutthroat: closing out with the higher score does not end the game (GF-02 repro)", () => {
  const players = ["chuck", "matthew"];
  const { ns, winner } = playCricket(players, "cutthroat", [
    ["chuck", [T("19"), T("18"), T("17")]],
    ["matthew", [T("20"), T("20"), T("20")]], // 120 on Chuck
    ["chuck", [T("16"), T("15"), T("B")]],
    ["matthew", [MISS, MISS, MISS]],
    ["chuck", [S("B"), T("20")]], // Chuck has closed every number, holding 120
  ]);
  assert.equal(ns.chuck.points, 120);
  assert.equal(ns.matthew.points, 0);
  assert.equal(winner, null, "Matthew must not be handed the win");
  assert.deepEqual(cricketClosedNotWinning(ns, { players, variant: "cutthroat" }), ["chuck"]);
});

test("cutthroat: the closer wins once their score is lowest or equal-lowest", () => {
  const players = ["chuck", "matthew"];
  const opening = [
    ["chuck", [T("19"), T("18"), T("17")]],
    ["matthew", [T("20"), T("20"), MISS]], // 60 on Chuck
  ];
  // level at 60 when Chuck closes out: equal-lowest, the closer wins
  const level = playCricket(players, "cutthroat", [
    ...opening,
    ["chuck", [T("15"), T("15"), S("15")]], // 60 on Matthew
    ["matthew", [MISS]],
    ["chuck", [T("16"), T("20"), T("B")]],
    ["matthew", [MISS]],
    ["chuck", [S("B")]],
  ]);
  assert.equal(level.ns.matthew.points, 60);
  assert.equal(level.winner, "chuck");
  // closed out while behind (60 to 45): play on, then win once Matthew passes him
  const behind = [
    ...opening,
    ["chuck", [T("15"), T("15")]], // 45 on Matthew
    ["matthew", [MISS]],
    ["chuck", [T("16"), T("20"), T("B")]],
    ["matthew", [MISS]],
    ["chuck", [S("B")]],
  ];
  const mid = playCricket(players, "cutthroat", behind);
  assert.equal(mid.winner, null);
  assert.deepEqual(cricketClosedNotWinning(mid.ns, { players, variant: "cutthroat" }), ["chuck"]);
  const end = playCricket(players, "cutthroat", [...behind, ["matthew", [MISS]], ["chuck", [S("15")]]]);
  assert.equal(end.ns.matthew.points, 60);
  assert.equal(end.winner, "chuck");
});

test("cutthroat: a closed player can win at the end of someone else's visit", () => {
  const players = ["a", "b", "c"];
  const ns = Object.fromEntries(players.map((u) => [u, blankCricketPlayer()]));
  Object.keys(ns.a.marks).forEach((t) => (ns.a.marks[t] = 3));
  ns.a.points = 120;
  ns.b.points = 150;
  ns.c.points = 100;
  ns.b.marks["20"] = 3; // b can score 20s on c, who is open
  assert.equal(cricketWinner(ns, { players, variant: "cutthroat", cur: "c" }), null);
  applyCricketVisit(ns, "b", [T("20")], { players, variant: "cutthroat" });
  assert.equal(ns.c.points, 160);
  assert.equal(ns.a.points, 120, "a closed player takes no points");
  assert.equal(cricketWinner(ns, { players, variant: "cutthroat", cur: "b" }), "a");
});

test("cricket score and no-score endings are unchanged", () => {
  const players = ["a", "b"];
  const closeAll = [T("20"), T("19"), T("18")];
  const rest = [T("17"), T("16"), T("15")];
  const std = playCricket(players, "standard", [
    ["a", closeAll],
    ["b", [T("20"), T("20"), MISS]],
    ["a", rest],
    ["b", [MISS]],
  ]);
  assert.equal(std.winner, null);
  // a closes the bull while 0-0: leads (level) on points, wins
  const won = playCricket(players, "standard", [
    ["a", closeAll],
    ["b", [MISS]],
    ["a", rest],
    ["b", [MISS]],
    ["a", [T("B"), S("B")]],
  ]);
  assert.equal(won.winner, "a");
  const ns = playCricket(players, "noscore", [["a", closeAll], ["b", [MISS]], ["a", rest], ["b", [MISS]], ["a", [T("B"), S("B")]]]);
  assert.equal(ns.winner, "a");
});

test("cricket End turn: needs a dart, and drops a double tap (GF-06)", () => {
  assert.equal(canEndTurn(0, 0, 10_000), false, "no darts entered");
  assert.equal(canEndTurn(1, 0, 10_000), true, "a single Miss is a dart");
  assert.equal(canEndTurn(3, 10_000, 10_000 + 120), false, "second tap of a double tap");
  assert.equal(canEndTurn(3, 10_000, 10_000 + END_TURN_GUARD_MS + 1), true);
});

// ---------- baseball ----------

/** Score a whole inning for each player; returns the finish, or the next turn. */
function playBaseball(players, inningsRuns) {
  const state = Object.fromEntries(players.map((u) => [u, { innings: [], total: 0 }]));
  let turn = 0;
  let result = null;
  const thrown = [];
  for (const runs of inningsRuns) {
    // runs: { player: runs } for the players who should be at the oche
    for (;;) {
      const inning = Math.floor(turn / players.length) + 1;
      const cur = players[turn % players.length];
      if (!(cur in runs)) break;
      thrown.push(`${inning}:${cur}`);
      state[cur].innings.push(runs[cur]);
      state[cur].total += runs[cur];
      result = baseballAfterVisit(state, players, turn);
      if (result.done) return { state, result, thrown };
      const done = turn;
      turn = result.turn;
      if (Math.floor(turn / players.length) !== Math.floor(done / players.length)) break;
    }
  }
  return { state, result, thrown, turn };
}

test("baseball: only the tied leaders play extra innings (GF-03 repro)", () => {
  const players = ["chuck", "matthew", "gracie"];
  const regulation = Array.from({ length: 9 }, (_, i) => ({ chuck: 1, matthew: 1, gracie: i < 8 ? 1 : 0 }));
  const { state, result, thrown } = playBaseball(players, [...regulation, { chuck: 0, matthew: 0 }, { chuck: 2, matthew: 1 }]);
  assert.equal(state.gracie.total, 8);
  assert.deepEqual(baseballContenders(state, players, 10), ["chuck", "matthew"]);
  assert.ok(!thrown.includes("10:gracie"), "Gracie does not throw in the 10th");
  assert.ok(!thrown.includes("11:gracie"));
  assert.deepEqual(result, { done: true, winner: "chuck" });
});

test("baseball: a clear leader after nine wins at once; a solo game ends after nine", () => {
  const players = ["a", "b"];
  const nine = Array.from({ length: 9 }, () => ({ a: 2, b: 1 }));
  assert.deepEqual(playBaseball(players, nine).result, { done: true, winner: "a" });
  const solo = playBaseball(["a"], Array.from({ length: 9 }, () => ({ a: 0 })));
  assert.deepEqual(solo.result, { done: true, winner: "a" });
});

test("baseball: extras narrow to whoever is still level, skipping a first-seat player who is out", () => {
  const players = ["gracie", "chuck", "matthew", "lindsey"];
  const nine = Array.from({ length: 9 }, () => ({ gracie: 0, chuck: 1, matthew: 1, lindsey: 1 }));
  const { result, thrown, turn } = playBaseball(players, [...nine, { chuck: 1, matthew: 1, lindsey: 0 }]);
  assert.equal(result.done, false);
  assert.ok(!thrown.includes("10:gracie"));
  assert.ok(thrown.includes("10:lindsey"));
  // the 11th starts with Chuck: Gracie (out since the 9th) and Lindsey (out after the 10th) are skipped
  assert.equal(players[turn % players.length], "chuck");
  assert.equal(Math.floor(turn / players.length) + 1, 11);
});

// ---------- X01 ----------

const D = (n) => ({ n, mult: 2 });
const Sx = (n) => ({ n, mult: 1 });

test("x01 visit outcome follows the double-out rules", () => {
  assert.equal(x01VisitOutcome(50, [D(25)], true), "win");
  assert.equal(x01VisitOutcome(32, [Sx(16), Sx(16)], true), "bust", "a single can't finish double out");
  assert.equal(x01VisitOutcome(32, [Sx(16), Sx(16)], false), "win");
  assert.equal(x01VisitOutcome(17, [Sx(16)], true), "bust", "can't leave 1");
  assert.equal(x01VisitOutcome(10, [Sx(11)], false), "bust");
  assert.equal(x01VisitOutcome(100, [Sx(20)], true), null);
  assert.equal(x01VisitOutcome(100, [Sx(20), Sx(20), Sx(20)], true), "normal");
});

test("x01 checkout is held for confirm, never final on the tap (GF-04)", () => {
  // single-leg ranked game: the finishing dart waits for an explicit confirm
  assert.deepEqual(checkoutConfirmation({ isBot: false, legsWon: 0, legs: 1 }), { hold: true, winsMatch: true, autoMs: null });
  // best of 3, first leg: undoable for a few seconds, then it counts by itself
  assert.deepEqual(checkoutConfirmation({ isBot: false, legsWon: 0, legs: 3 }), { hold: true, winsMatch: false, autoMs: CHECKOUT_AUTO_CONFIRM_MS });
  // best of 3 at 1-0: this leg wins the match, so it waits for confirm
  assert.equal(checkoutConfirmation({ isBot: false, legsWon: 1, legs: 3 }).autoMs, null);
  // bots don't mis-tap
  assert.deepEqual(checkoutConfirmation({ isBot: true, legsWon: 0, legs: 1 }), { hold: false });
});
