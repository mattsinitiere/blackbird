import { test } from "node:test";
import assert from "node:assert/strict";
import { legalFinishes, recommend, routeLabel, remainingDarts } from "../lib/strategy/x01.js";
import { doubleRates, wilson, targetRate } from "../lib/strategy/evidence.js";
import { recommendCricket } from "../lib/strategy/cricket.js";
import { STANDARD_DOUBLES, MIN_TARGET_ATTEMPTS, CONFIDENCE_Z } from "../lib/strategy/config.js";
import { dartValue } from "../lib/darts.js";

const BOGEYS = [169, 168, 166, 165, 163, 162, 159];
const sum = (route) => route.reduce((a, d) => a + dartValue(d), 0);
const key = (route) => routeLabel(route);

test("config: standard doubles order and thresholds", () => {
  assert.equal(STANDARD_DOUBLES.length, 20);
  assert.deepEqual(STANDARD_DOUBLES.slice(0, 3), ["D20", "D16", "D8"]);
  assert.equal(STANDARD_DOUBLES[19], "D1");
  assert.equal(MIN_TARGET_ATTEMPTS, 30);
  assert.equal(CONFIDENCE_Z, 1.645);
});

test("legalFinishes + recommend: every state 2..170 × 1..3 darts × double/straight out", () => {
  for (const doubleOut of [true, false]) {
    for (let rem = 2; rem <= 170; rem++) {
      for (let darts = 1; darts <= 3; darts++) {
        const all = legalFinishes(rem, darts, { doubleOut });
        const seen = new Set();
        for (const r of all) {
          assert.ok(r.length >= 1 && r.length <= darts, `${rem}/${darts}: length`);
          assert.equal(sum(r), rem, `${rem}/${darts}: ${key(r)} sums`);
          if (doubleOut) assert.equal(r[r.length - 1].mult, 2, `${rem}/${darts}: ${key(r)} ends on a double`);
          assert.ok(!seen.has(key(r)), `${rem}/${darts}: ${key(r)} duplicated`);
          seen.add(key(r));
        }
        const rec = recommend({ remaining: rem, dartsLeft: darts, doubleOut });
        if (all.length) {
          assert.equal(rec.kind, "checkout", `${rem}/${darts}`);
          assert.ok(seen.has(key(rec.route)), `${rem}/${darts}: ${key(rec.route)} is legal`);
          if (rec.alternative) assert.ok(seen.has(key(rec.alternative)), `${rem}/${darts}: alternative legal`);
        } else {
          assert.notEqual(rec.kind, "checkout", `${rem}/${darts}: never a checkout without a legal finish`);
          assert.equal(rec.kind, "setup", `${rem}/${darts}`);
          assert.ok(rec.route.length >= 1 && rec.route.length <= darts);
          const leave = rem - sum(rec.route);
          assert.ok(leave >= (doubleOut ? 2 : 1), `${rem}/${darts}: setup never busts`);
        }
        assert.equal(typeof rec.reason, "string");
      }
    }
  }
});

test("legalFinishes: permutations of setup darts are listed once, higher value first", () => {
  const r = legalFinishes(100, 3).map(key);
  assert.ok(r.includes("T20 D20"));
  assert.ok(r.includes("T20 S20 D10"));
  assert.ok(!r.includes("S20 T20 D10"));
  assert.ok(r.includes("T20 S10 D15"));
  assert.ok(!r.includes("S10 T20 D15"));
  assert.deepEqual(legalFinishes(40, 1).map(key), ["D20"]);
  assert.deepEqual(legalFinishes(170, 3).map(key), ["T20 T20 Bull"]);
  assert.deepEqual(legalFinishes(60, 1, { doubleOut: false }).map(key), ["T20"]);
});

test("recommend: known cases", () => {
  const r = (remaining, dartsLeft, o = {}) => recommend({ remaining, dartsLeft, ...o });
  assert.equal(key(r(170, 3).route), "T20 T20 Bull");
  assert.equal(r(170, 3).kind, "checkout");
  assert.equal(r(170, 2).kind, "setup");
  assert.equal(key(r(40, 1).route), "D20");
  assert.equal(key(r(50, 1).route), "Bull");
  assert.equal(key(r(3, 3).route), "S1 D1");
  assert.equal(r(1, 3).kind, "none");
  assert.equal(r(0, 3).kind, "none");
  assert.equal(r(-4, 3).kind, "none");
  assert.equal(r(40, 0).kind, "none");
  for (const b of BOGEYS) {
    const x = r(b, 3);
    assert.equal(x.kind, "setup", `${b}`);
    assert.doesNotMatch(x.reason, /checkout/i);
  }
  const so = r(60, 1, { doubleOut: false });
  assert.equal(so.kind, "checkout");
  assert.equal(key(so.route), "T20");
  assert.equal(key(r(100, 3).route), "T20 D20");
  // one dart, no finish: set up a double
  const s60 = r(60, 1);
  assert.equal(s60.kind, "setup");
  assert.equal(key(s60.route), "S20");
  // out of range: score
  assert.equal(key(r(501, 3).route), "T20 T20 T20");
  assert.equal(r(501, 3).kind, "setup");
  // T20 would leave the 169 bogey
  assert.equal(key(r(229, 1).route), "T19");
});

test("recommend: pure — an undo/correction sequence gives the same answers as fresh calls", () => {
  const a = recommend({ remaining: 100, dartsLeft: 3 });
  const b = recommend({ remaining: 60, dartsLeft: 2 });
  const c = recommend({ remaining: 100, dartsLeft: 3 });
  assert.deepEqual(c, a);
  assert.deepEqual(b, recommend({ remaining: 60, dartsLeft: 2 }));
  // mutating a returned route does not leak into later calls
  a.route[0].n = 1;
  assert.equal(key(recommend({ remaining: 100, dartsLeft: 3 }).route), "T20 D20");
  assert.equal(key(legalFinishes(100, 2)[0]), key(legalFinishes(100, 2)[0]));
});

test("remainingDarts and routeLabel", () => {
  assert.equal(remainingDarts([]), 3);
  assert.equal(remainingDarts([{ n: 20, mult: 3 }]), 2);
  assert.equal(remainingDarts([{}, {}, {}]), 0);
  assert.equal(remainingDarts(undefined), 3);
  assert.equal(routeLabel([{ n: 25, mult: 1 }, { n: 25, mult: 2 }, { n: 20, mult: 3 }, { n: 5, mult: 1 }]), "25 Bull T20 S5");
});

test("preferredDouble: taken when on in the same darts, else standard", () => {
  const p = recommend({ remaining: 32, dartsLeft: 1, preferredDouble: "D16" });
  assert.equal(key(p.route), "D16");
  assert.equal(p.basis, "preference");
  const q = recommend({ remaining: 40, dartsLeft: 1, preferredDouble: "D16" });
  assert.equal(key(q.route), "D20");
  assert.equal(q.basis, "standard");
  // 48 with two darts: standard S8 D20; S16 D16 is just as cheap
  assert.equal(key(recommend({ remaining: 48, dartsLeft: 2 }).route), "S8 D20");
  const r = recommend({ remaining: 48, dartsLeft: 2, preferredDouble: "D16" });
  assert.equal(key(r.route), "S16 D16");
  assert.equal(r.basis, "preference");
  assert.ok(r.alternative, "standard best becomes the alternative");
  assert.notEqual(key(r.alternative), key(r.route));
});

// ---- evidence ------------------------------------------------------------------

const aimed = (n, hits, attempts) => {
  const darts = [];
  for (let i = 0; i < attempts; i++) darts.push(i < hits ? { n, mult: 2, a: { n, mult: 2 } } : { n, mult: 1, a: { n, mult: 2 } });
  return darts;
};
const x01Row = (username, darts) => ({ username, gameType: "x01", stats: { v: 2, visits: [{ i: 0, r: 0, s0: 501, darts, out: {} }] } });

test("wilson and targetRate", () => {
  const w = wilson(0, 0);
  assert.equal(w.p, null);
  const x = wilson(50, 100);
  assert.equal(x.p, 0.5);
  assert.ok(x.lo < 0.5 && x.hi > 0.5 && x.lo > 0.41 && x.hi < 0.59);
  assert.equal(targetRate({ byDouble: {} }, "D20"), null);
  const t = targetRate({ byDouble: { D20: { attempts: 10, hits: 4 } } }, "D20");
  assert.equal(t.rate, 0.4);
  assert.equal(t.attempts, 10);
});

test("doubleRates: only known targets count; untargeted darts are unknown", () => {
  const rows = [
    x01Row("ann", [{ n: 20, mult: 2 }, { n: 16, mult: 2 }, { n: 1, mult: 1 }]), // no aim: unknown
    x01Row("ann", aimed(16, 2, 3)),
    x01Row("bob", aimed(16, 3, 3)), // someone else
    { username: "ann", gameType: "x01", stats: { darts: [{ n: 20, mult: 3 }, { n: 20, mult: 1 }] } }, // legacy
    {
      username: "ann",
      gameType: "bobs27",
      stats: { v: 2, visits: [{ i: 0, r: 0, s0: 27, darts: [{ n: 1, mult: 2 }, { n: 1, mult: 1 }, { n: 0, mult: 0 }] }, { i: 1, r: 20, s0: 29, darts: [{ n: 25, mult: 2 }] }] },
    },
  ];
  const ev = doubleRates(rows, { me: "ann" });
  assert.deepEqual(ev.byDouble.D16, { attempts: 3, hits: 2 });
  assert.deepEqual(ev.byDouble.D20, { attempts: 0, hits: 0 });
  assert.deepEqual(ev.byDouble.D1, { attempts: 3, hits: 1 });
  assert.deepEqual(ev.byDouble.Bull, { attempts: 1, hits: 1 });
  assert.equal(ev.unknownDarts, 5);
  assert.equal(ev.sources.aimedDarts, 3);
  assert.equal(ev.sources.bobs27Games, 1);
  // X01 rows without aims give no attempts at all
  const none = doubleRates([x01Row("ann", [{ n: 20, mult: 2 }, { n: 20, mult: 2 }])], { me: "ann" });
  assert.equal(Object.values(none.byDouble).reduce((a, r) => a + r.attempts, 0), 0);
  assert.equal(none.unknownDarts, 2);
});

test("recommend with evidence: small samples stay standard, a clear large-sample edge uses data", () => {
  const small = doubleRates([x01Row("ann", [...aimed(16, 15, 20), ...aimed(20, 2, 20)])], { me: "ann" });
  const s = recommend({ remaining: 48, dartsLeft: 2, evidence: small });
  assert.equal(s.basis, "standard");
  assert.equal(s.route[s.route.length - 1].n, 20);

  const big = doubleRates([x01Row("ann", [...aimed(16, 30, 60), ...aimed(20, 6, 60)])], { me: "ann" });
  const d = recommend({ remaining: 48, dartsLeft: 2, evidence: big });
  assert.equal(d.basis, "data");
  assert.equal(key([d.route[d.route.length - 1]]), "D16");
  assert.equal(d.kind, "checkout");
  assert.ok(legalFinishes(48, 2).map(key).includes(key(d.route)));
  assert.equal(d.evidence.double, "D16");
  assert.equal(d.evidence.versus.double, "D20");
  assert.ok(d.evidence.lo > d.evidence.versus.hi);
  assert.equal(d.alternative[d.alternative.length - 1].n, 20);

  // large but overlapping samples: no override
  const close = doubleRates([x01Row("ann", [...aimed(16, 20, 60), ...aimed(20, 17, 60)])], { me: "ann" });
  assert.equal(recommend({ remaining: 48, dartsLeft: 2, evidence: close }).basis, "standard");
  // data never produces a checkout that isn't there
  assert.equal(recommend({ remaining: 40, dartsLeft: 1, evidence: big }).basis, "standard");
});

// ---- cricket -------------------------------------------------------------------

const marks = (m = {}) => ({ 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, B: 0, ...m });
const all = (n = 3) => marks({ 20: n, 19: n, 18: n, 17: n, 16: n, 15: n, B: n });

test("cricket: close highest open number by default", () => {
  const state = { ann: { marks: marks(), points: 0 }, bob: { marks: marks(), points: 0 } };
  assert.deepEqual(recommendCricket({ me: "ann", players: ["ann", "bob"], state }).target, "20");
  const s2 = { ann: { marks: marks({ 20: 3 }), points: 0 }, bob: { marks: marks({ 20: 3 }), points: 0 } };
  const r = recommendCricket({ me: "ann", players: ["ann", "bob"], state: s2 });
  assert.equal(r.action, "close");
  assert.equal(r.target, "19");
  assert.equal(r.basis, "standard");
});

test("cricket: defend a number the opponent can score on", () => {
  const state = { ann: { marks: marks({ 20: 3 }), points: 0 }, bob: { marks: marks({ 20: 3, 18: 3 }), points: 36 } };
  const r = recommendCricket({ me: "ann", players: ["ann", "bob"], state });
  assert.equal(r.action, "close");
  assert.equal(r.target, "18");
});

test("cricket: score when behind with a live closed number", () => {
  const state = { ann: { marks: marks({ 20: 3, 19: 3 }), points: 0 }, bob: { marks: marks({ 19: 3 }), points: 57 } };
  const r = recommendCricket({ me: "ann", players: ["ann", "bob"], state });
  assert.equal(r.action, "score");
  assert.equal(r.target, "20");
});

test("cricket: bull endgame and done", () => {
  const m = all();
  m.B = 1;
  const state = { ann: { marks: m, points: 40 }, bob: { marks: all(), points: 20 } };
  const r = recommendCricket({ me: "ann", players: ["ann", "bob"], state });
  assert.equal(r.action, "bull");
  assert.equal(r.target, "B");
  const d = recommendCricket({ me: "ann", players: ["ann", "bob"], state: { ann: { marks: all(), points: 40 }, bob: { marks: all(), points: 20 } } });
  assert.equal(d.action, "done");
});

test("cricket: no-score never recommends scoring", () => {
  const cases = [
    { ann: { marks: marks({ 20: 3 }), points: 0 }, bob: { marks: marks({ 18: 3 }), points: 0 } },
    { ann: { marks: all(), points: 0 }, bob: { marks: marks(), points: 0 } },
    { ann: { marks: marks({ 20: 5, 19: 3 }), points: 0 }, bob: { marks: all(), points: 0 } },
  ];
  for (const state of cases) {
    const r = recommendCricket({ variant: "noscore", me: "ann", players: ["ann", "bob"], state });
    assert.notEqual(r.action, "score");
  }
  const r = recommendCricket({ variant: "noscore", me: "ann", players: ["ann", "bob"], state: cases[0] });
  assert.equal(r.target, "19");
});

test("cricket: cutthroat defends and piles points on the leader-by-low-score", () => {
  const def = { ann: { marks: marks(), points: 0 }, bob: { marks: marks({ 17: 3 }), points: 0 } };
  assert.equal(recommendCricket({ variant: "cutthroat", me: "ann", players: ["ann", "bob"], state: def }).target, "17");
  const pile = { ann: { marks: marks({ 20: 3 }), points: 60 }, bob: { marks: marks(), points: 0 } };
  const r = recommendCricket({ variant: "cutthroat", me: "ann", players: ["ann", "bob"], state: pile });
  assert.equal(r.action, "score");
  assert.equal(r.target, "20");
});
