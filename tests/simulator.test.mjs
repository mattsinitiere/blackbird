import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, gaussian, throwAt } from "../lib/simulator.js";
import { aimPoint } from "../lib/board.js";
import { BOTS } from "../lib/bots.js";

const value = (d) => (d.n === 0 ? 0 : d.n === 25 ? 25 * d.mult : d.n * d.mult);

test("seeded rng is deterministic and uniform-ish", () => {
  const a = mulberry32(1);
  const b = mulberry32(1);
  const xs = Array.from({ length: 5 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 5 }, () => b()));
  const rng = mulberry32(9);
  let sum = 0;
  for (let i = 0; i < 20000; i++) sum += rng();
  assert.ok(Math.abs(sum / 20000 - 0.5) < 0.01);
});

test("gaussian samples have unit variance", () => {
  const rng = mulberry32(3);
  let s = 0;
  let s2 = 0;
  const N = 40000;
  for (let i = 0; i < N; i++) {
    const g = gaussian(rng);
    s += g;
    s2 += g * g;
  }
  assert.ok(Math.abs(s / N) < 0.02);
  assert.ok(Math.abs(s2 / N - 1) < 0.03);
});

test("zero error lands exactly on the aim point", () => {
  const d = throwAt(aimPoint(19, 3), 0, mulberry32(1));
  assert.equal(d.n, 19);
  assert.equal(d.mult, 3);
});

test("every bot's sigma reproduces its nominal 3-dart average at T20 (Monte Carlo)", () => {
  const aim = aimPoint(20, 3);
  for (const bot of BOTS) {
    const rng = mulberry32(1234);
    const N = 30000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += value(throwAt(aim, bot.sigma, rng));
    const avg = (sum / N) * 3;
    assert.ok(Math.abs(avg - bot.avg) <= 3, `${bot.name}: simulated ${avg.toFixed(1)} vs nominal ${bot.avg}`);
  }
});

test("bots get monotonically more accurate up the ladder", () => {
  for (let i = 1; i < BOTS.length; i++) {
    assert.ok(BOTS[i].sigma < BOTS[i - 1].sigma);
    assert.ok(BOTS[i].avg > BOTS[i - 1].avg);
    assert.ok(BOTS[i].checkout >= BOTS[i - 1].checkout);
    assert.equal(BOTS[i].level, i + 1);
  }
});
