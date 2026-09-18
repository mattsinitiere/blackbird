import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOBS27_START,
  BOBS27_ROUNDS,
  bobsTarget,
  isBobsHit,
  bobsRoundScore,
  checkoutTargets,
  applyCheckoutDart,
  scoringDartValue,
  CHECKOUT_DRILL_MIN,
  CHECKOUT_DRILL_MAX,
} from "../lib/drills.js";
import { isCheckoutRange } from "../lib/checkouts.js";

test("bob's 27: targets, hits and round scoring", () => {
  assert.equal(BOBS27_START, 27);
  assert.equal(BOBS27_ROUNDS, 21);
  assert.deepEqual(bobsTarget(1), { n: 1, mult: 2, label: "D1", value: 2 });
  assert.deepEqual(bobsTarget(20), { n: 20, mult: 2, label: "D20", value: 40 });
  assert.deepEqual(bobsTarget(21), { n: 25, mult: 2, label: "D-Bull", value: 50 });
  assert.equal(isBobsHit(5, { n: 5, mult: 2 }), true);
  assert.equal(isBobsHit(5, { n: 5, mult: 1 }), false);
  assert.equal(isBobsHit(21, { n: 25, mult: 2 }), true);
  assert.equal(isBobsHit(21, { n: 25, mult: 1 }), false);
  assert.deepEqual(bobsRoundScore(3, [{ n: 3, mult: 2 }, { n: 3, mult: 2 }, { n: 0, mult: 0 }]), { hits: 2, delta: 12 });
  assert.deepEqual(bobsRoundScore(3, [{ n: 0, mult: 0 }, { n: 3, mult: 1 }, { n: 4, mult: 2 }]), { hits: 0, delta: -6 });
  assert.deepEqual(bobsRoundScore(21, [{ n: 25, mult: 2 }]), { hits: 1, delta: 50 });
});

test("checkout drill: targets come from the checkoutable range with no repeats in a row", () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const t = checkoutTargets(40, rng);
  assert.equal(t.length, 40);
  for (let i = 0; i < t.length; i++) {
    assert.ok(t[i] >= CHECKOUT_DRILL_MIN && t[i] <= CHECKOUT_DRILL_MAX, `${t[i]} in range`);
    assert.ok(isCheckoutRange(t[i]), `${t[i]} checkoutable`);
    if (i > 0) assert.notEqual(t[i], t[i - 1]);
  }
});

test("checkout drill: double-out rules per dart", () => {
  assert.deepEqual(applyCheckoutDart(100, { n: 20, mult: 3 }), { rem: 40, status: "open" });
  assert.deepEqual(applyCheckoutDart(40, { n: 20, mult: 2 }), { rem: 0, status: "hit" });
  assert.deepEqual(applyCheckoutDart(40, { n: 20, mult: 1 }), { rem: 20, status: "open" });
  assert.deepEqual(applyCheckoutDart(20, { n: 20, mult: 1 }), { rem: 20, status: "bust" }); // single to zero
  assert.deepEqual(applyCheckoutDart(41, { n: 20, mult: 2 }), { rem: 41, status: "bust" }); // leaves 1
  assert.deepEqual(applyCheckoutDart(10, { n: 20, mult: 1 }), { rem: 10, status: "bust" }); // below zero
  assert.deepEqual(applyCheckoutDart(50, { n: 25, mult: 2 }), { rem: 0, status: "hit" }); // bull is a double
  assert.deepEqual(applyCheckoutDart(50, { n: 0, mult: 0 }), { rem: 50, status: "open" });
});

test("scoring drill: only the target counts", () => {
  assert.equal(scoringDartValue(20, { n: 20, mult: 3 }), 60);
  assert.equal(scoringDartValue(20, { n: 5, mult: 3 }), 0);
  assert.equal(scoringDartValue(20, { n: 0, mult: 0 }), 0);
  assert.equal(scoringDartValue(25, { n: 25, mult: 2 }), 50);
  assert.equal(scoringDartValue(25, { n: 25, mult: 1 }), 25);
});
