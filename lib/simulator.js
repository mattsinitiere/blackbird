import { segmentAt } from "./board.js";

/**
 * Throw simulator: aim at a point on the board and land somewhere nearby.
 * Landing error is an isotropic Gaussian with standard deviation `sigma`
 * millimetres, so a weak thrower going for T20 lands in 1 and 5 like a
 * person does. Pure: randomness comes only from the injected rng.
 */

/** Small seeded PRNG for tests and calibration. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One standard normal sample (Box–Muller, one of the pair). */
export function gaussian(rng = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Throw at `aim` ({x, y} mm) with error `sigma` mm. Returns { n, mult, x, y }. */
export function throwAt(aim, sigma, rng = Math.random) {
  const x = aim.x + gaussian(rng) * sigma;
  const y = aim.y + gaussian(rng) * sigma;
  return { ...segmentAt(x, y), x, y };
}
