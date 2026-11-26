import { test } from "node:test";
import assert from "node:assert/strict";
import { ticTacToeDartOutcome, TTT_GRID } from "../lib/gamestats/tictactoe.js";
import { visitEntry, undoVisit } from "../lib/visitUndo.js";
import { canEndTurn, END_TURN_GUARD_MS } from "../lib/cricket.js";
import { tiebreakOutcome } from "../lib/tiebreak.js";
import { niceTicks, niceStep } from "../lib/chartTicks.js";
import { lastVisitToShow, describeX01Visit, describeCricketVisit, describeBaseballVisit } from "../lib/lastVisit.js";

const S = (n, mult = 1) => ({ n, mult });
const MISS = { n: 0, mult: 0 };
const empty = () => Array(9).fill(null);

// ---- Tic-Tac-Toe: the dart that completes a line waits for a confirm -------

test("tic-tac-toe: a dart completing a line is a win to confirm, even on dart three", () => {
  const [a, , , , b, , , , c] = TTT_GRID; // a diagonal: 20, 16, 12
  assert.equal(ticTacToeDartOutcome(empty(), "chuck", [S(a)]), null);
  assert.equal(ticTacToeDartOutcome(empty(), "chuck", [S(a), S(b)]), null);
  assert.equal(ticTacToeDartOutcome(empty(), "chuck", [S(a), S(b), S(c)]), "win");
  // with two squares already owned the first dart can complete the line
  const board = empty();
  board[0] = "chuck";
  board[4] = "chuck";
  assert.equal(ticTacToeDartOutcome(board, "chuck", [S(c)]), "win");
});

test("tic-tac-toe: the third dart without a line ends the visit; undoing the win dart reopens it", () => {
  assert.equal(ticTacToeDartOutcome(empty(), "chuck", [S(20), MISS, S(5)]), "end");
  const visit = [S(20), S(16), S(12)];
  assert.equal(ticTacToeDartOutcome(empty(), "chuck", visit.slice(0, -1)), null, "Undo dart leaves a visit that goes on");
});

// ---- X01: Undo after a confirmed leg drops only the finishing dart ---------

test("x01: reopening a confirmed leg puts back the visit minus its finishing dart", () => {
  const before = { scores: { chuck: 121 } };
  const legEntry = { ...visitEntry({ s: before, turn: 4, darts: [S(20, 3), S(11), S(25, 2)] }), legsWon: { chuck: 0 }, legHistory: [] };
  const plainVisit = { s: { scores: { chuck: 301 } }, turn: 5 }; // a scored visit saves no darts
  const back = undoVisit([legEntry, plainVisit]);
  assert.deepEqual(back.entry.darts, [], "a scored visit reopens empty");
  const leg = undoVisit(back.history);
  assert.deepEqual(leg.entry.darts, [S(20, 3), S(11)]);
  assert.equal(leg.entry.s.scores.chuck, 121);
  assert.deepEqual(leg.entry.legsWon, { chuck: 0 });
});

// ---- Killer: End turn guard (shared with Cricket) --------------------------

test("killer end turn: needs a dart, and a double tap does not skip the next player", () => {
  assert.equal(canEndTurn(0, 0, 5_000), false);
  assert.equal(canEndTurn(1, 0, 5_000), true);
  assert.equal(canEndTurn(2, 5_000, 5_000 + END_TURN_GUARD_MS - 1), false);
  assert.equal(canEndTurn(2, 5_000, 5_000 + END_TURN_GUARD_MS + 1), true);
});

// ---- Shanghai / Halve It: the tiebreak on the result screen ----------------

test("tiebreak outcome: none without a tiebreak", () => {
  assert.equal(tiebreakOutcome({ a: { score: 40 }, b: { score: 20 } }, "a"), null);
  assert.equal(tiebreakOutcome({}, "a"), null);
});

test("tiebreak outcome: the deciding round's score, winner first", () => {
  const out = tiebreakOutcome({ chuck: { tiebreak: [60] }, matt: { tiebreak: [0] } }, "chuck");
  assert.equal(out.score, "60–0");
  assert.equal(out.text, "won the tiebreak 60–0");
  assert.deepEqual(out.byPlayer, { chuck: "60", matt: "0" });
});

test("tiebreak outcome: after a level round, and a player knocked out of it earlier", () => {
  const pp = { chuck: { tiebreak: [20, 45] }, matt: { tiebreak: [20, 26] }, gracie: { tiebreak: [5] }, lindsey: { score: 3 } };
  const out = tiebreakOutcome(pp, "chuck");
  assert.equal(out.round, 2);
  assert.equal(out.score, "45–26");
  assert.equal(out.text, "won the tiebreak 45–26, in round 2");
  assert.deepEqual(out.byPlayer, { chuck: "20 · 45", matt: "20 · 26", gracie: "5" });
});

// ---- charts: gridlines at the values their labels show ---------------------

test("chart ticks: Killer's lives get one gridline per life, at the exact values", () => {
  const t = niceTicks(0, 3, { integer: true, floor: 0 });
  assert.deepEqual(t.ticks, [0, 1, 2, 3]);
  assert.equal(t.min, 0);
  assert.equal(t.max, 3);
});

test("chart ticks: small integer ranges never get fractional ticks", () => {
  for (const hi of [1, 2, 4, 5, 7, 9]) {
    const t = niceTicks(0, hi, { integer: true, floor: 0 });
    assert.ok(t.ticks.every(Number.isInteger), `0..${hi}: ${t.ticks}`);
    assert.ok(t.max >= hi && t.min <= 0);
  }
  assert.equal(niceStep(0.4, true), 1);
});

test("chart ticks: steps are 1, 2, 2.5 or 5 times a power of ten and cover the data", () => {
  const cases = [[0, 301], [0, 346], [47.3, 52.1], [0.21, 0.63], [-12, 40], [1000, 1180], [12, 97]];
  for (const [lo, hi] of cases) {
    const t = niceTicks(lo, hi);
    assert.ok(t.min <= lo && t.max >= hi, `${lo}..${hi} covered by ${t.min}..${t.max}`);
    const m = t.step / Math.pow(10, Math.floor(Math.log10(t.step)));
    assert.ok([1, 2, 2.5, 5].some((x) => Math.abs(x - m) < 1e-9), `step ${t.step}`);
    // evenly spaced, and each label is the value (no rounding needed)
    t.ticks.forEach((v, i) => assert.ok(Math.abs(v - (t.min + i * t.step)) < 1e-9));
    assert.equal(t.ticks[0], t.min);
    assert.equal(t.ticks[t.ticks.length - 1], t.max);
  }
  assert.deepEqual(niceTicks(0.21, 0.63).ticks, [0.2, 0.4, 0.6, 0.8]);
});

test("chart ticks: a single value and a percentage stay in range", () => {
  assert.deepEqual(niceTicks(0, 0, { integer: true, floor: 0 }).ticks, [0, 1]);
  assert.deepEqual(niceTicks(5, 5, { integer: true, floor: 0 }).ticks, [4, 5, 6]);
  const pct = niceTicks(12, 97, { floor: 0, ceil: 100 });
  assert.equal(pct.max, 100);
  assert.equal(pct.min, 0);
});

// ---- the last visit line after a bot's visit -------------------------------

test("last visit: a bot's visit shows until the person's first dart", () => {
  const last = { by: "bot:sparrow", darts: [S(20), S(18), S(18)], k: "normal", s: 56, rem: 445 };
  assert.equal(lastVisitToShow(last, { cur: "chuck", thrown: 0, botsOnly: true }), last);
  assert.equal(lastVisitToShow(last, { cur: "chuck", thrown: 1, botsOnly: true }), null, "gone after the first dart");
  assert.equal(lastVisitToShow(last, { cur: "bot:sparrow", thrown: 0, botsOnly: true }), null);
  assert.equal(lastVisitToShow(last, { cur: "chuck", thrown: 0, botAtOche: true }), null);
  assert.equal(lastVisitToShow({ ...last, by: "matt" }, { cur: "chuck", botsOnly: true }), null, "a person's visit was seen");
  assert.ok(lastVisitToShow({ ...last, by: "matt" }, { cur: "chuck" }), "Killer shows everyone's");
  assert.equal(lastVisitToShow(null, { cur: "chuck" }), null);
});

test("last visit: what each game says about it", () => {
  assert.equal(describeX01Visit({ k: "normal", s: 56, rem: 445 }), "scored 56, 445 left");
  assert.equal(describeX01Visit({ k: "bust", s: 0, rem: 32 }), "bust, still on 32");
  assert.equal(describeX01Visit({ k: "win", s: 40, rem: 0 }), "checked out 40");
  assert.equal(describeCricketVisit({ marks: 0, pts: 0 }), "no marks");
  assert.equal(describeCricketVisit({ marks: 4, pts: 20 }), "4 marks, +20 points");
  assert.equal(describeCricketVisit({ marks: 1, pts: 19, variant: "cutthroat" }), "1 mark, 19 points to the others");
  assert.equal(describeBaseballVisit({ runs: 1 }), "1 run");
  assert.equal(describeBaseballVisit({ runs: 0 }), "no runs");
});
