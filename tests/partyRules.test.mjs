import { test } from "node:test";
import assert from "node:assert/strict";
import { visitEntry, undoVisit } from "../lib/visitUndo.js";
import { topScorers, startTiebreak, tiebreakThrower, tiebreakScore, addTiebreakVisit } from "../lib/tiebreak.js";
import { killerAlive, killerVisitOver, describeKillerVisit, previewKillerVisit, applyKillerDart } from "../lib/killer.js";

const S = (n, mult = 1) => ({ n, mult });
const MISS = { n: 0, mult: 0 };

// ---- undo after a committed visit ------------------------------------------

test("undo: a visit ended by its third dart reopens with the first two in place", () => {
  const s = { scores: { Ann: 40 } };
  const darts = [S(20, 2), S(19, 2), S(5)];
  const e = visitEntry({ s, turn: 3, by: "Ann", darts });
  s.scores.Ann = 999; // later changes never leak into the snapshot
  assert.deepEqual(e, { s: { scores: { Ann: 40 } }, turn: 3, by: "Ann", darts: [S(20, 2), S(19, 2)] });
  const back = undoVisit([e]);
  assert.deepEqual(back.entry.darts, [S(20, 2), S(19, 2)]);
  assert.equal(back.entry.turn, 3);
  assert.deepEqual(back.history, []);
});

test("undo: a visit ended with End turn reopens whole", () => {
  const e = visitEntry({ s: {}, turn: 0, by: "Ann", darts: [S(1), S(2)], auto: false });
  assert.deepEqual(undoVisit([e]).entry.darts, [S(1), S(2)]);
});

test("undo: a bust or winning dart on dart one reopens an empty visit", () => {
  const e = visitEntry({ s: {}, turn: 0, by: "Ann", darts: [S(20, 3)] });
  assert.deepEqual(undoVisit([e]).entry.darts, []);
});

test("undo: passes over bot visits to the person's own last visit", () => {
  const h = [
    visitEntry({ s: { k: 1 }, turn: 0, by: "Ann", darts: [S(5, 2), S(6, 2), S(7)] }),
    visitEntry({ s: { k: 2 }, turn: 1, by: "bot:jay", darts: [MISS, MISS, MISS] }),
  ];
  const back = undoVisit(h, { skip: (e) => e.by.startsWith("bot:") });
  assert.deepEqual(back.entry.s, { k: 1 });
  assert.deepEqual(back.entry.darts, [S(5, 2), S(6, 2)]);
  assert.deepEqual(back.history, []);
  // nothing of the person's own to undo yet
  assert.equal(undoVisit([h[1]], { skip: (e) => e.by.startsWith("bot:") }), null);
  assert.equal(undoVisit([]), null);
});

test("undo: history saved before darts were kept still undoes (empty visit)", () => {
  const back = undoVisit([{ s: { a: 1 }, turn: 2 }]);
  assert.deepEqual(back.entry.darts, []);
  assert.equal(back.entry.turn, 2);
});

// ---- Shanghai / Halve It tiebreak -------------------------------------------

test("tiebreak: a clear leader needs none; a shared top score starts one", () => {
  assert.deepEqual(topScorers({ A: 10, B: 12, C: 12 }, ["A", "B", "C"]), ["B", "C"]);
  assert.deepEqual(topScorers({ A: 0, B: 0 }, ["A", "B"]), ["A", "B"]);
  assert.equal(startTiebreak(["B"]), null);
  const tb = startTiebreak(["B", "C"]);
  assert.equal(tiebreakThrower(tb), "B");
});

test("tiebreak: the higher three-dart total wins after both have thrown", () => {
  let tb = startTiebreak(["A", "B"]);
  let out = addTiebreakVisit(tb, [S(20), S(1), MISS]);
  assert.equal(out.winner, null, "no winner until everyone tied has thrown");
  assert.equal(tiebreakThrower(out.tb), "B");
  out = addTiebreakVisit(out.tb, [S(25, 2), MISS, MISS]);
  assert.equal(out.winner, "B");
  assert.deepEqual(out.tb.totals, { A: [21], B: [50] });
});

test("tiebreak: still level goes again with only those still level", () => {
  let tb = startTiebreak(["A", "B", "C"]);
  tb = addTiebreakVisit(tb, [S(20)]).tb; // A 20
  tb = addTiebreakVisit(tb, [S(10)]).tb; // B 10: out
  let out = addTiebreakVisit(tb, [S(5, 2), S(10)]); // C 20: level with A
  assert.equal(out.winner, null);
  assert.deepEqual(out.tb.players, ["A", "C"]);
  assert.equal(out.tb.round, 1);
  assert.equal(tiebreakThrower(out.tb), "A");
  out = addTiebreakVisit(out.tb, [MISS, MISS, MISS]);
  out = addTiebreakVisit(out.tb, [S(1)]);
  assert.equal(out.winner, "C");
  assert.deepEqual(out.tb.totals, { A: [20, 0], B: [10], C: [20, 1] });
});

test("tiebreak: misses all round keep going rather than favoring whoever threw first", () => {
  let out = addTiebreakVisit(startTiebreak(["A", "B"]), [MISS, MISS, MISS]);
  out = addTiebreakVisit(out.tb, [MISS, MISS, MISS]);
  assert.equal(out.winner, null);
  assert.deepEqual(out.tb.players, ["A", "B"]);
  assert.equal(tiebreakScore([S(20, 3), S(25, 1), MISS]), 85);
});

// ---- Killer: per-dart end of game and the last-visit line ------------------

const players = ["Ann", "Bob", "Cat"];
const numbers = { Ann: 5, Bob: 12, Cat: 18 };
const ctx = { players, numbers };
const D = (n) => ({ n, mult: 2 });

test("killer: the dart that leaves one player standing ends the visit at once", () => {
  const s = { lives: { Ann: 3, Bob: 0, Cat: 1 }, killer: { Ann: true, Bob: false, Cat: true } };
  assert.equal(killerVisitOver(s, "Ann", [MISS], ctx), false);
  assert.equal(killerVisitOver(s, "Ann", [D(18)], ctx), true, "Cat's last life: game over on dart one");
  assert.deepEqual(killerAlive(previewKillerVisit(s, "Ann", [D(18)], ctx), players), ["Ann"]);
  assert.equal(killerVisitOver(s, "Ann", [MISS, MISS, MISS], ctx), true, "three darts always end it");
});

test("killer: a thrower who knocks themselves out ends their visit", () => {
  const s = { lives: { Ann: 1, Bob: 3, Cat: 3 }, killer: { Ann: true, Bob: false, Cat: false } };
  assert.equal(killerVisitOver(s, "Ann", [D(5)], ctx), true);
});

test("killer: the preview shows killer status and lives dart by dart", () => {
  const s = { lives: { Ann: 3, Bob: 3, Cat: 3 }, killer: { Ann: false, Bob: false, Cat: false } };
  const p = previewKillerVisit(s, "Ann", [D(5), D(12)], ctx);
  assert.equal(p.killer.Ann, true);
  assert.equal(p.lives.Bob, 2);
  assert.equal(s.lives.Bob, 3, "the committed state is untouched");
});

test("killer: describing a visit", () => {
  assert.equal(describeKillerVisit([]), "no effect");
  const st = { lives: { Ann: 3, Bob: 1, Cat: 3 }, killer: { Ann: false, Bob: false, Cat: false } };
  const evs = [...applyKillerDart(st, "Ann", D(5), ctx), ...applyKillerDart(st, "Ann", D(12), ctx), ...applyKillerDart(st, "Ann", D(18), ctx)];
  assert.equal(describeKillerVisit(evs), "became a killer, knocked out Bob, took a life from Cat");
  assert.equal(describeKillerVisit([{ t: "hit", by: "Ann", on: "Cat" }], { me: "Cat" }), "took 1 of your lives");
  assert.equal(describeKillerVisit([{ t: "hit", by: "Ann", on: "Cat" }, { t: "elim", by: "Ann", on: "Cat" }], { me: "Cat" }), "knocked you out");
  assert.equal(describeKillerVisit([{ t: "self", by: "Ann" }]), "lost a life on their own double");
  assert.equal(describeKillerVisit([{ t: "hit", by: "x", on: "bot:jay" }], { label: () => "Jay" }), "took a life from Jay");
});
