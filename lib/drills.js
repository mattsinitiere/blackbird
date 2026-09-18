import { isCheckoutRange } from "./checkouts.js";

/**
 * Rules for the practice drills. Pure: no React, no clock, randomness only
 * through an injected rng. The play components keep state and rendering;
 * everything scoreable lives here so it can be unit-tested.
 */

// ---- Bob's 27 -------------------------------------------------------------
// Start on 27. Round r (1..20) is double r; round 21 is the double bull.
// Three darts per round: +2r per double hit, -2r if all three miss.
// Drop to 0 or below and you are out.

export const BOBS27_START = 27;
export const BOBS27_ROUNDS = 21;

export function bobsTarget(round) {
  return round >= BOBS27_ROUNDS ? { n: 25, mult: 2, label: "D-Bull", value: 50 } : { n: round, mult: 2, label: `D${round}`, value: round * 2 };
}

export function isBobsHit(round, dart) {
  const t = bobsTarget(round);
  return !!dart && dart.n === t.n && dart.mult === 2;
}

/** Score change for one round given its darts (up to 3). */
export function bobsRoundScore(round, darts) {
  const t = bobsTarget(round);
  const hits = (darts || []).filter((d) => isBobsHit(round, d)).length;
  return { hits, delta: hits > 0 ? hits * t.value : -t.value };
}

// ---- Checkout drill ---------------------------------------------------------
// A run of random double-out finishes between 41 and 170. Up to three
// visits (nine darts) per finish; a bust ends the visit and restores the
// score it started on.

export const CHECKOUT_DRILL_MIN = 41;
export const CHECKOUT_DRILL_MAX = 170;
export const CHECKOUT_DRILL_DARTS = 9;

const CHECKOUT_POOL = [];
for (let n = CHECKOUT_DRILL_MIN; n <= CHECKOUT_DRILL_MAX; n++) if (isCheckoutRange(n)) CHECKOUT_POOL.push(n);

/** `count` finishes from the pool, no two the same in a row. */
export function checkoutTargets(count, rng = Math.random) {
  const out = [];
  let last = null;
  for (let i = 0; i < count; i++) {
    let pick;
    do pick = CHECKOUT_POOL[Math.floor(rng() * CHECKOUT_POOL.length)];
    while (pick === last && CHECKOUT_POOL.length > 1);
    out.push(pick);
    last = pick;
  }
  return out;
}

const dartValue = (d) => (d.n === 0 ? 0 : d.n === 25 ? 25 * d.mult : d.n * d.mult);

/**
 * Apply one dart to a remaining score under double-out rules.
 * Returns { rem, status } with status 'open' | 'hit' | 'bust'.
 */
export function applyCheckoutDart(rem, dart) {
  const next = rem - dartValue(dart);
  if (next < 0 || next === 1) return { rem, status: "bust" };
  if (next === 0) return dart.mult === 2 ? { rem: 0, status: "hit" } : { rem, status: "bust" };
  return { rem: next, status: "open" };
}

// ---- Scoring drill ---------------------------------------------------------
// N visits at one number (or the bull). Only darts in that number count.

export const SCORING_TARGETS = [20, 19, 18, 25];
export const SCORING_TURNS = [5, 10, 20];

export function scoringDartValue(target, dart) {
  if (!dart || dart.n !== target) return 0;
  return dartValue(dart);
}

export function scoringTargetLabel(target) {
  return target === 25 ? "Bull" : `${target}s`;
}
