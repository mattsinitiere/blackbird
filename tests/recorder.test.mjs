import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecorder, ensureRecorder, stamp, recordVisit, recordEvent, finishRecorder, stripDarts } from "../lib/recorder.js";

const START = "2026-09-24T19:00:00.000Z";

test("createRecorder: one visit list per player", () => {
  const rec = createRecorder({ players: ["Ann", "Bob"], startedAt: START });
  assert.equal(rec.v, 2);
  assert.deepEqual(Object.keys(rec.visits), ["Ann", "Bob"]);
  assert.deepEqual(rec.events, []);
});

test("stamp: throw time relative to the start, omitted when the start is unknown", () => {
  const now = Date.parse(START) + 41200;
  assert.deepEqual(stamp({ n: 20, mult: 3 }, START, now), { n: 20, mult: 3, t: 41200 });
  assert.deepEqual(stamp({ n: 20, mult: 3 }, null, now), { n: 20, mult: 3 });
  assert.deepEqual(stamp({ n: 20, mult: 3 }, "garbage", now), { n: 20, mult: 3 });
});

test("recordVisit: sequential index per player, darts cleaned to n/mult/t/x", () => {
  const rec = createRecorder({ players: ["Ann"], startedAt: START });
  recordVisit(rec, "Ann", { r: 0, s0: 501, darts: [{ n: 20, mult: 3, t: 5, land: { n: 1, mult: 1 } }, { n: 0, mult: 0, x: { m: 0 } }], out: { k: "score", s: 60, rem: 441 } });
  recordVisit(rec, "Ann", { r: 0, s0: 441, darts: [], out: { k: "bust", s: 0, rem: 441 } });
  assert.equal(rec.visits.Ann.length, 2);
  assert.deepEqual(rec.visits.Ann[0].darts, [{ n: 20, mult: 3, t: 5 }, { n: 0, mult: 0, x: { m: 0 } }]);
  assert.equal(rec.visits.Ann[1].i, 1);
  // a player who was not in the roster still gets a list
  recordVisit(rec, "Cy", { darts: [{ n: 1, mult: 1 }] });
  assert.equal(rec.visits.Cy.length, 1);
});

test("undo via JSON snapshots restores the earlier recorder", () => {
  const s = { scores: { Ann: 501 }, rec: createRecorder({ players: ["Ann"], startedAt: START }) };
  const before = JSON.parse(JSON.stringify(s));
  recordVisit(s.rec, "Ann", { s0: 501, darts: [{ n: 20, mult: 1 }], out: { k: "score", s: 20, rem: 481 } });
  assert.equal(s.rec.visits.Ann.length, 1);
  assert.equal(before.rec.visits.Ann.length, 0);
  const restored = JSON.parse(JSON.stringify(before));
  assert.equal(restored.rec.visits.Ann.length, 0);
});

test("finishRecorder: per-player block with duration and events", () => {
  const rec = createRecorder({ players: ["Ann", "Bob"], startedAt: START });
  recordVisit(rec, "Ann", { s0: 1, darts: [{ n: 1, mult: 1 }], out: {} });
  recordEvent(rec, { t: "reset", by: "Ann", on: "Bob", turn: 3 });
  const block = finishRecorder(rec, "Ann", "2026-09-24T19:10:00.000Z");
  assert.equal(block.v, 2);
  assert.equal(block.durationMs, 600000);
  assert.equal(block.visits.length, 1);
  assert.deepEqual(block.events, [{ t: "reset", by: "Ann", on: "Bob", turn: 3 }]);
  assert.equal(block.partial, undefined);
  const bob = finishRecorder(rec, "Bob", "2026-09-24T19:10:00.000Z");
  assert.equal(bob.visits.length, 0);
});

test("ensureRecorder marks a resumed pre-v2 snapshot partial", () => {
  const s = ensureRecorder({ scores: {} }, { players: ["Ann"], startedAt: START });
  assert.equal(s.rec.partial, true);
  const block = finishRecorder(s.rec, "Ann", null);
  assert.equal(block.partial, true);
  assert.equal(block.durationMs, undefined);
  const fresh = { rec: createRecorder({ players: ["Ann"], startedAt: START }) };
  assert.equal(ensureRecorder(fresh, { players: ["Ann"] }).rec.partial, undefined);
});

test("stripDarts keeps only the landing", () => {
  assert.deepEqual(stripDarts([{ n: 20, mult: 3, t: 9, x: { m: 1 } }]), [{ n: 20, mult: 3 }]);
});
