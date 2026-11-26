import { test } from "node:test";
import assert from "node:assert/strict";
import { tvHasBoard, tvCardGrid, tvCardSize, tvCardPx, killerCurrent, killerTargets, lastX01Visit } from "../lib/tvLayout.js";

const SCREENS = [
  [1600, 900],
  [1920, 1080],
];

test("tv: only layouts with a dartboard offer the board toggle", () => {
  for (const g of ["x01", "cricket", "baseball", "killer", "shanghai"]) assert.equal(tvHasBoard(g), true, g);
  for (const g of ["tictactoe", "halveit", "gotcha", "aroundTheClock", "bobs27"]) assert.equal(tvHasBoard(g), false, g);
});

test("tv: four players go 2x2 next to the board, one row without it", () => {
  assert.deepEqual(tvCardGrid(2, { board: true }), { cols: 2, rows: 1 });
  assert.deepEqual(tvCardGrid(3, { board: true }), { cols: 3, rows: 1 });
  assert.deepEqual(tvCardGrid(4, { board: true }), { cols: 2, rows: 2 });
  assert.deepEqual(tvCardGrid(4, { board: false }), { cols: 4, rows: 1 });
});

test("tv: X01 cards for 1-4 players fit 1600x900 and 1920x1080, board or not", () => {
  for (const [w, h] of SCREENS) {
    for (const board of [true, false]) {
      for (let n = 1; n <= 4; n++) {
        const size = tvCardSize(n, { board, chars: 3 });
        const px = tvCardPx(size, w, h);
        // width: a 3-digit score (about 1.9em) plus padding inside one column
        const area = ((board ? 0.6 : 0.92) * w) / size.cols;
        assert.ok(px * 1.9 + px * 0.24 <= area, `${n}p board=${board} ${w}x${h}: ${px}px too wide for ${area}px`);
        // height: about 2.1em per card row must fit 70% of the screen
        assert.ok(px * 2.1 * size.rows <= 0.7 * h + 1, `${n}p board=${board} ${w}x${h}: ${px}px too tall`);
        // and still big enough to read across a room
        assert.ok(px >= 80, `${n}p board=${board} ${w}x${h}: ${px}px too small`);
      }
    }
  }
});

test("tv: in one row, more players never get a bigger score than fewer", () => {
  let prev = Infinity;
  for (let n = 1; n <= 4; n++) {
    const px = tvCardPx(tvCardSize(n, { board: false }), 1600, 900);
    assert.ok(px <= prev, `${n} players`);
    prev = px;
  }
});

test("tv: Killer skips players who are out, like the phone", () => {
  const players = ["Ann", "Bo", "Cy"];
  assert.equal(killerCurrent(players, { Ann: 3, Bo: 3, Cy: 3 }, 1), "Bo");
  assert.equal(killerCurrent(players, { Ann: 3, Bo: 0, Cy: 3 }, 1), "Cy");
  assert.equal(killerCurrent(players, { Ann: 3, Bo: 0, Cy: 0 }, 1), "Ann");
});

test("tv: Killer targets are your own double, then the living opponents'", () => {
  const players = ["Ann", "Bo", "Cy"];
  const numbers = { Ann: 2, Bo: 14, Cy: 16 };
  const lives = { Ann: 3, Bo: 0, Cy: 2 };
  assert.deepEqual(killerTargets(players, numbers, lives, { Ann: false }, "Ann"), [2]);
  assert.deepEqual(killerTargets(players, numbers, lives, { Ann: true }, "Ann"), [16]);
});

test("tv: X01 last visit comes from the recorder, current leg only", () => {
  const rec = {
    visits: {
      Ann: [
        { r: 0, out: { k: "ok", s: 60 } },
        { r: 0, out: { k: "ok", s: 180 } },
      ],
      Bo: [{ r: 0, out: { k: "bust", s: 0 } }],
      Cy: [],
    },
  };
  assert.deepEqual(lastX01Visit(rec, "Ann", 0), { score: 180, bust: false });
  assert.deepEqual(lastX01Visit(rec, "Bo", 0), { score: 0, bust: true });
  assert.equal(lastX01Visit(rec, "Cy", 0), null);
  assert.equal(lastX01Visit(rec, "Ann", 1), null); // a new leg starts clean
  assert.equal(lastX01Visit(undefined, "Ann"), null);
});
