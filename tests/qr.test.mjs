import { test } from "node:test";
import assert from "node:assert/strict";
import { qrMatrix, inFinder } from "../lib/qr.js";

test("qrMatrix builds a square grid with the three finder squares", () => {
  const { n, dark } = qrMatrix("https://blackbird.example/");
  assert.ok(n >= 21 && (n - 17) % 4 === 0, `size ${n}`);
  // finder: dark outer ring, light ring, dark 3×3 center
  for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    assert.equal(dark(r0, c0), true);
    assert.equal(dark(r0 + 1, c0 + 1), false);
    assert.equal(dark(r0 + 3, c0 + 3), true);
  }
  assert.equal(dark(-1, 0), false);
  assert.equal(inFinder(n, 3, 3), true);
  assert.equal(inFinder(n, 10, 10), false);
});
