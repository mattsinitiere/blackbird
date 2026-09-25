import { dartValue, dartLabel } from "../darts.js";
import {
  DOUBLE_ORDER,
  LEAVE_PREFERENCE,
  SETUP_NUMBERS,
  SETUP_BED_COST,
  BOGEY_PENALTY,
  PREFERENCE_SETUP_MARGIN,
  MIN_TARGET_ATTEMPTS,
  DARTS_PER_VISIT,
} from "./config.js";
import { doubleLabel, targetRate } from "./evidence.js";

/**
 * X01 finishing strategy: every legal finish, a deterministic ranking of
 * them, and a setup shot when no finish is on. Pure: no React, no clock,
 * no randomness. Darts are { n, mult } (n 25 = bull, mult 2 = inner bull).
 *
 * Standard ranking of finishes (lower is better, compared in order):
 *   1. fewest darts;
 *   2. fewest awkward setup darts (a double, 25 or the bull thrown as a
 *      setup — small targets for no reason);
 *   3. the final dart: DOUBLE_ORDER (D20, D16, D8 … D1, bull last) when
 *      playing double out; straight out prefers a single, then a double,
 *      then a treble, then 25, then the bull;
 *   4. robustness: setup darts whose likely miss (the single of the same
 *      number instead of its treble/double) still leaves a finish with the
 *      darts left — singles count as robust;
 *   5. setup cost: SETUP_BED_COST by bed plus the SETUP_NUMBERS index
 *      (singles/trebles of 20, 19, 18 … before anything else);
 *   6. per-dart setup cost, first dart first, then the label, so ties are
 *      always broken the same way.
 *
 * Setup darts inside a route are in canonical order: higher value first
 * (ties: treble before double before single, then higher number). The
 * finishing dart is always last.
 */

const bed = (n, mult) => Object.freeze({ n, mult });

/** Every scoring bed, canonical order: value desc, then mult desc, then n desc. */
const BEDS = (() => {
  const list = [];
  for (let n = 1; n <= 20; n++) for (const m of [1, 2, 3]) list.push(bed(n, m));
  list.push(bed(25, 1), bed(25, 2));
  return list.sort(bedOrder);
})();

function bedOrder(a, b) {
  return dartValue(b) - dartValue(a) || b.mult - a.mult || b.n - a.n;
}

/** Beds a setup visit aims at when no finish is on: singles and trebles 1–20. */
const SETUP_BEDS = BEDS.filter((d) => d.n <= 20 && d.mult !== 2);

const MAX_FINISH = { true: 170, false: 180 };

// ---- the finish table (built once per rule set, then shared) --------------

const TABLES = {};

/** Map total → routes (1..3 darts, canonical order) finishing exactly on it. */
function table(doubleOut) {
  const key = doubleOut ? "true" : "false";
  if (TABLES[key]) return TABLES[key];
  const byTotal = new Map();
  const add = (route) => {
    const t = route.reduce((a, d) => a + dartValue(d), 0);
    if (!byTotal.has(t)) byTotal.set(t, []);
    byTotal.get(t).push(route);
  };
  const finishers = doubleOut ? BEDS.filter((d) => d.mult === 2) : BEDS;
  for (const f of finishers) add([f]);
  for (const s of BEDS) for (const f of finishers) add([s, f]);
  for (let i = 0; i < BEDS.length; i++) {
    for (let j = i; j < BEDS.length; j++) for (const f of finishers) add([BEDS[i], BEDS[j], f]);
  }
  const minLen = new Map();
  for (const [t, routes] of byTotal) minLen.set(t, Math.min(...routes.map((r) => r.length)));
  TABLES[key] = { byTotal, minLen, best: new Map() };
  return TABLES[key];
}

/** Fewest darts that finish `rem` (Infinity when none within three). */
function minDarts(rem, doubleOut) {
  return table(doubleOut).minLen.get(rem) ?? Infinity;
}

const canFinish = (rem, darts, doubleOut) => darts > 0 && minDarts(rem, doubleOut) <= darts;

/**
 * Every legal finishing sequence for `remaining` with at most `dartsLeft`
 * darts. Double out: the last dart is a double (the bull counts). Straight
 * out: any scoring dart may finish. Fresh { n, mult } objects each call.
 */
export function legalFinishes(remaining, dartsLeft, { doubleOut = true } = {}) {
  const routes = table(!!doubleOut).byTotal.get(remaining) || [];
  const max = Math.min(DARTS_PER_VISIT, Math.floor(dartsLeft) || 0);
  return routes.filter((r) => r.length <= max).map((r) => r.map((d) => ({ n: d.n, mult: d.mult })));
}

// ---- ranking ----------------------------------------------------------------

const numberRank = (n) => {
  const i = SETUP_NUMBERS.indexOf(n);
  return i === -1 ? SETUP_NUMBERS.length : i;
};

function setupDartCost(d) {
  if (d.n === 25) return d.mult === 2 ? SETUP_BED_COST.bull : SETUP_BED_COST.outerBull;
  const base = d.mult === 3 ? SETUP_BED_COST.treble : d.mult === 2 ? SETUP_BED_COST.double : SETUP_BED_COST.single;
  return base + numberRank(d.n);
}

function finalRank(d, doubleOut) {
  if (doubleOut) return DOUBLE_ORDER.indexOf(doubleLabel(d));
  if (d.n === 25) return d.mult === 2 ? 400 : 300;
  if (d.mult === 1) return numberRank(d.n);
  if (d.mult === 2) return 100 + DOUBLE_ORDER.indexOf(doubleLabel(d));
  return 200 + numberRank(d.n);
}

function robustness(route, remaining, dartsLeft, doubleOut) {
  let score = 0;
  let rem = remaining;
  for (let k = 0; k < route.length - 1; k++) {
    const d = route[k];
    if (d.mult === 1 && d.n !== 25) score++;
    else {
      const alt = rem - (d.n === 25 ? 25 : d.n); // the likely miss: single of the same number / 25 for the bull
      const left = dartsLeft - k - 1;
      if (alt === 0 ? !doubleOut && d.n !== 25 : alt >= (doubleOut ? 2 : 1) && canFinish(alt, left, doubleOut)) score++;
    }
    rem -= dartValue(d);
  }
  return score;
}

function routeKey(route, remaining, dartsLeft, doubleOut) {
  const setups = route.slice(0, -1).map(setupDartCost);
  while (setups.length < 2) setups.push(0);
  const awkward = route.slice(0, -1).filter((d) => d.mult === 2 || d.n === 25).length;
  return [
    route.length,
    awkward,
    finalRank(route[route.length - 1], doubleOut),
    -robustness(route, remaining, dartsLeft, doubleOut),
    setups[0] + setups[1],
    setups[0],
    setups[1],
    routeLabel(route),
  ];
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** Legal finishes, best first, each as { route, key }. Internal (shared bed objects). */
function rankedFinishes(remaining, dartsLeft, doubleOut) {
  const routes = (table(doubleOut).byTotal.get(remaining) || []).filter((r) => r.length <= dartsLeft);
  return routes
    .map((route) => ({ route, key: routeKey(route, remaining, dartsLeft, doubleOut) }))
    .sort((a, b) => compareKeys(a.key, b.key));
}

/** The standard best finish with a full visit, memoised (used to grade leaves). */
function bestFullVisit(rem, doubleOut) {
  const t = table(doubleOut);
  if (!t.best.has(rem)) t.best.set(rem, rankedFinishes(rem, DARTS_PER_VISIT, doubleOut)[0] || null);
  return t.best.get(rem);
}

// ---- labels -----------------------------------------------------------------

/** "T20 T20 Bull", "S20 D20", "25" — the lib/checkouts.js conventions. */
export function routeLabel(route) {
  return (route || []).map(dartLabel).join(" ");
}

/** Darts still to throw this visit given the darts already entered. */
export function remainingDarts(turnDarts) {
  return Math.max(0, DARTS_PER_VISIT - (Array.isArray(turnDarts) ? turnDarts.length : 0));
}

const copy = (route) => (route ? route.map((d) => ({ n: d.n, mult: d.mult })) : null);
const finalOf = (route) => route[route.length - 1];

function normaliseDouble(label) {
  if (typeof label !== "string") return null;
  const s = label.trim().toUpperCase();
  if (s === "BULL" || s === "D25" || s === "DB" || s === "D-BULL" || s === "50") return "Bull";
  return DOUBLE_ORDER.includes(s) ? s : null;
}

// ---- setup when no finish is on --------------------------------------------

/** How good a leave is for the next visit (lower is better). */
function leaveKey(leave, doubleOut) {
  const best = bestFullVisit(leave, doubleOut);
  if (!best) {
    const bogey = leave <= MAX_FINISH[doubleOut];
    return { tier: 3, inner: leave + (bogey ? BOGEY_PENALTY : 0), best: null, bogey };
  }
  const len = best.route.length;
  let inner = best.key[2];
  if (len === 1 && doubleOut) {
    const i = LEAVE_PREFERENCE.indexOf(leave);
    inner = i !== -1 ? i : LEAVE_PREFERENCE.length + best.key[2];
  }
  return { tier: len - 1, inner, best, bogey: false };
}

function setupCandidates(remaining, k, doubleOut) {
  const min = doubleOut ? 2 : 1;
  const out = [];
  const consider = (route) => {
    const leave = remaining - route.reduce((a, d) => a + dartValue(d), 0);
    if (leave < min) return;
    const lk = leaveKey(leave, doubleOut);
    const costs = route.map(setupDartCost);
    const key = [lk.tier, lk.inner, costs.reduce((a, c) => a + c, 0), ...costs, routeLabel(route)];
    out.push({ route, leave, lk, key });
  };
  const B = SETUP_BEDS;
  for (let i = 0; i < B.length; i++) {
    if (k === 1) consider([B[i]]);
    else {
      for (let j = i; j < B.length; j++) {
        if (k === 2) consider([B[i], B[j]]);
        else for (let l = j; l < B.length; l++) consider([B[i], B[j], B[l]]);
      }
    }
  }
  return out.sort((a, b) => compareKeys(a.key, b.key));
}

function leaveText(c) {
  const { leave, lk } = c;
  if (lk.tier === 0) return `leaves ${leave}, a one-dart finish (${routeLabel(lk.best.route)})`;
  if (lk.tier === 1) return `leaves ${leave}, a two-dart finish (${routeLabel(lk.best.route)})`;
  if (lk.tier === 2) return `leaves ${leave}, a three-dart finish (${routeLabel(lk.best.route)})`;
  return lk.bogey ? `leaves ${leave} (no finish; the least bad option)` : `leaves ${leave}`;
}

// ---- the recommendation -----------------------------------------------------

/**
 * Advice for the dart(s) still to throw this visit.
 *
 * @param {{ remaining: number, dartsLeft: number, doubleOut?: boolean,
 *           preferredDouble?: string|null, evidence?: object|null }} input
 *   evidence: a doubleRates() result (or its byDouble map) — never invented.
 * @returns {{ kind: "checkout"|"setup"|"none", route: Array<{n,mult}>,
 *             alternative: Array<{n,mult}>|null, basis: "standard"|"preference"|"data",
 *             reason: string, evidence: object|null }}
 */
export function recommend({ remaining, dartsLeft, doubleOut = true, preferredDouble = null, evidence = null } = {}) {
  const dOut = !!doubleOut;
  const none = (reason) => ({ kind: "none", route: [], alternative: null, basis: "standard", reason, evidence: null });
  const k = Math.floor(dartsLeft);
  if (!Number.isFinite(remaining) || !Number.isInteger(remaining)) return none("No score to advise on.");
  if (remaining <= 0) return none("Nothing left to score.");
  if (!(k >= 1)) return none("No darts left this visit.");
  if (dOut && remaining < 2) return none(`${remaining} left can't be finished on a double.`);
  const darts = Math.min(k, DARTS_PER_VISIT);

  const ranked = rankedFinishes(remaining, darts, dOut);
  if (ranked.length) return checkoutAdvice(ranked, { remaining, darts, dOut, preferredDouble, evidence });

  const cands = setupCandidates(remaining, darts, dOut);
  if (!cands.length) return none(`No safe setup from ${remaining} with ${darts} dart${darts === 1 ? "" : "s"}.`);
  const pick = cands[0];
  const label = routeLabel(pick.route);
  const alt = cands.find((c) => routeLabel(c.route) !== label);
  const why = remaining > MAX_FINISH[dOut] ? `${remaining} is out of finishing range` : `No finish from ${remaining} with ${darts} dart${darts === 1 ? "" : "s"}`;
  return {
    kind: "setup",
    route: copy(pick.route),
    alternative: alt ? copy(alt.route) : null,
    basis: "standard",
    reason: `${why}; ${label} ${leaveText(pick)}.`,
    evidence: null,
  };
}

function checkoutAdvice(ranked, { darts, dOut, preferredDouble, evidence }) {
  const best = ranked[0];
  const bestLen = best.route.length;
  const sameLen = ranked.filter((r) => r.route.length === bestLen);
  const firstPerDouble = [];
  const seen = new Set();
  for (const r of sameLen) {
    const lab = doubleLabel(finalOf(r.route));
    if (lab && !seen.has(lab)) {
      seen.add(lab);
      firstPerDouble.push({ lab, r });
    }
  }

  let choice = best;
  let basis = "standard";
  let ev = null;

  // 1. personal data: only a conservative, well-sampled win over the standard double
  const stdLab = doubleLabel(finalOf(best.route));
  if (evidence && stdLab) {
    const std = targetRate(evidence, stdLab);
    if (std && std.attempts >= MIN_TARGET_ATTEMPTS) {
      let top = null;
      for (const { lab, r } of firstPerDouble) {
        if (lab === stdLab) continue;
        const c = targetRate(evidence, lab);
        if (c && c.attempts >= MIN_TARGET_ATTEMPTS && c.lo > std.hi && (!top || c.lo > top.c.lo)) top = { c, r };
      }
      if (top) {
        choice = top.r;
        basis = "data";
        ev = { double: top.c.label, attempts: top.c.attempts, hits: top.c.hits, rate: top.c.rate, lo: top.c.lo, hi: top.c.hi, versus: { double: std.label, attempts: std.attempts, hits: std.hits, rate: std.rate, lo: std.lo, hi: std.hi } };
      }
    }
  }

  // 2. the player's preferred double, when it costs (almost) nothing
  const pref = normaliseDouble(preferredDouble);
  if (basis === "standard" && pref) {
    const hit = firstPerDouble.find((x) => x.lab === pref);
    if (hit && hit.r.key[1] <= best.key[1] && hit.r.key[4] <= best.key[4] + PREFERENCE_SETUP_MARGIN) {
      choice = hit.r;
      basis = "preference";
    }
  }

  const chosenFinal = doubleLabel(finalOf(choice.route)) || routeLabel([finalOf(choice.route)]);
  let alternative = null;
  if (choice !== best) alternative = best.route;
  else {
    const alt = ranked.find((r) => r.route.length !== choice.route.length || routeLabel([finalOf(r.route)]) !== routeLabel([finalOf(choice.route)]));
    alternative = alt ? alt.route : null;
  }

  const n = choice.route.length;
  const count = `${n}-dart finish`;
  let reason;
  if (basis === "data") {
    const pc = (x) => `${Math.round(x * 100)}%`;
    reason = `${count} on ${ev.double}: your ${ev.double} (${ev.hits}/${ev.attempts}, ${pc(ev.rate)}) beats ${ev.versus.double} (${ev.versus.hits}/${ev.versus.attempts}, ${pc(ev.versus.rate)}) with 90% confidence.`;
  } else if (basis === "preference") {
    reason = `${count} on your preferred double, ${chosenFinal}.`;
  } else {
    const rob = -choice.key[3];
    const setups = choice.route.length - 1;
    const tail = setups && rob === setups && choice.route.slice(0, -1).some((d) => d.mult !== 1) ? "; a single instead of the treble still leaves a finish" : "";
    reason = dOut
      ? `Fewest darts (${n}), finishing on ${chosenFinal}${tail}.`
      : `Fewest darts (${n}), straight out on ${routeLabel([finalOf(choice.route)])}${tail}.`;
  }
  if (pref && basis === "standard" && darts) {
    const has = firstPerDouble.some((x) => x.lab === pref);
    reason += has ? ` ${pref} needs a costlier setup here.` : ` ${pref} isn't on in ${n} dart${n === 1 ? "" : "s"}.`;
  }

  return { kind: "checkout", route: copy(choice.route), alternative: copy(alternative), basis, reason, evidence: ev };
}
