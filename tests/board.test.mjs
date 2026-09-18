import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER, RINGS, segmentAt, aimPoint, polar, angleOf } from "../lib/board.js";

test("segment order is the real board", () => {
  assert.equal(ORDER.length, 20);
  assert.equal(new Set(ORDER).size, 20);
  assert.equal(ORDER[0], 20);
  assert.equal(ORDER[5], 6); // 3 o'clock
  assert.equal(ORDER[10], 3); // 6 o'clock
  assert.equal(ORDER[15], 11); // 9 o'clock
});

test("every bed's aim point lands in that bed", () => {
  for (const n of ORDER) {
    for (const mult of [1, 2, 3]) {
      const p = aimPoint(n, mult);
      assert.deepEqual(segmentAt(p.x, p.y), { n, mult }, `${n}x${mult}`);
    }
  }
  assert.deepEqual(segmentAt(0, 0), { n: 25, mult: 2 });
  const b = aimPoint(25, 1);
  assert.deepEqual(segmentAt(b.x, b.y), { n: 25, mult: 1 });
});

test("ring boundaries and the edge of the board", () => {
  const top = (r) => segmentAt(0, -r); // straight up = 20
  assert.deepEqual(top(RINGS.bullInner), { n: 25, mult: 2 });
  assert.deepEqual(top(RINGS.bullOuter), { n: 25, mult: 1 });
  assert.deepEqual(top(50), { n: 20, mult: 1 });
  assert.deepEqual(top(RINGS.tripleInner), { n: 20, mult: 3 });
  assert.deepEqual(top(RINGS.tripleOuter), { n: 20, mult: 3 });
  assert.deepEqual(top(130), { n: 20, mult: 1 });
  assert.deepEqual(top(RINGS.doubleInner), { n: 20, mult: 2 });
  assert.deepEqual(top(RINGS.doubleOuter), { n: 20, mult: 2 });
  assert.deepEqual(top(RINGS.doubleOuter + 0.01), { n: 0, mult: 0 });
});

test("sector wires: 9 degrees either side of the 20 is still 20, beyond is 1 or 5", () => {
  const at = (deg) => {
    const p = polar(130, deg);
    return segmentAt(p.x, p.y).n;
  };
  assert.equal(at(8.9), 20);
  assert.equal(at(-8.9), 20);
  assert.equal(at(9.1), 1);
  assert.equal(at(-9.1), 5);
  assert.equal(at(90), 6);
  assert.equal(at(180), 3);
  assert.equal(at(270), 11);
  assert.equal(Math.round(angleOf(1, 0)), 90);
});
