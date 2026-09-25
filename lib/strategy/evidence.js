import { bobsTarget } from "../drills.js";
import { DOUBLE_ORDER, CONFIDENCE_Z } from "./config.js";

/**
 * Personal double-hitting evidence for the strategy engine.
 *
 * Only darts whose intended target is KNOWN count:
 * - any recorded dart carrying an aim `a: { n, mult }` (new recordings);
 * - Bob's 27 visits (stats v2), where the drill itself defines the target:
 *   visit r (0-based round) is aimed at bobsTarget(r + 1). An explicit `a`
 *   on such a dart still wins.
 * Darts without an aim are never guessed at (a dart that landed in D16 may
 * have been aimed at T16 or a D8 setup) — they are only counted as unknown.
 * Legacy Bob's 27 rows without stored visits are counted as unknown too.
 *
 * Pure: no React, no network.
 */

/** "D16" / "Bull" for a double target, else null. */
export function doubleLabel(t) {
  if (!t || t.mult !== 2) return null;
  if (t.n === 25) return "Bull";
  return t.n >= 1 && t.n <= 20 ? `D${t.n}` : null;
}

const validAim = (a) => !!a && typeof a === "object" && typeof a.n === "number" && typeof a.mult === "number";

/** A row's visits for `u`: stats.visits is the per-player array; tolerate a {user: [...]} map. */
function rowVisits(row, u) {
  const v = row?.stats?.visits;
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object" && Array.isArray(v[u])) return v[u];
  return null;
}

/**
 * Per-double attempts and hits from known-target darts.
 * @param {Array<{username:string, gameType:string, stats:object}>} rows camelCase game_results rows
 * @param {{me?: string}} opts only this player's rows when given
 * @returns {{ byDouble: Object<string,{attempts:number,hits:number}>,
 *            sources: { bobs27Games: number, aimedDarts: number },
 *            unknownDarts: number }}
 */
export function doubleRates(rows, { me } = {}) {
  const byDouble = {};
  for (const k of DOUBLE_ORDER) byDouble[k] = { attempts: 0, hits: 0 };
  const sources = { bobs27Games: 0, aimedDarts: 0 };
  let unknownDarts = 0;

  const count = (target, d) => {
    const k = doubleLabel(target);
    if (!k) return false;
    byDouble[k].attempts++;
    if (d.n === target.n && d.mult === 2) byDouble[k].hits++;
    return true;
  };

  for (const row of rows || []) {
    if (!row) continue;
    if (me && row.username !== me) continue;
    const u = me || row.username;
    const visits = rowVisits(row, u);
    const legacy = Array.isArray(row.stats?.darts) ? row.stats.darts.length : 0;
    if (!visits || !visits.length) {
      unknownDarts += legacy;
      continue;
    }
    const bobs = row.gameType === "bobs27";
    let used = false;
    for (const v of visits) {
      for (const d of v?.darts || []) {
        if (!d || typeof d.n !== "number") continue;
        if (validAim(d.a)) {
          sources.aimedDarts++;
          count(d.a, d);
          used = true;
        } else if (bobs && typeof v.r === "number") {
          if (count(bobsTarget(v.r + 1), d)) used = true;
        } else {
          unknownDarts++;
        }
      }
    }
    if (bobs && used) sources.bobs27Games++;
  }
  return { byDouble, sources, unknownDarts };
}

/**
 * Wilson score interval for hits / n.
 * @returns {{ lo: number, hi: number, p: number|null }} p null (and 0..1) when n is 0
 */
export function wilson(hits, n, z = CONFIDENCE_Z) {
  if (!(n > 0)) return { lo: 0, hi: 1, p: null };
  const p = hits / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p };
}

/**
 * One double's evidence: { label, attempts, hits, rate, lo, hi } or null
 * when there is no evidence for it. `rates` is a doubleRates() result or
 * its `byDouble` map.
 */
export function targetRate(rates, label, z = CONFIDENCE_Z) {
  const map = rates?.byDouble || rates;
  const r = map?.[label];
  if (!r || !(r.attempts > 0)) return null;
  const w = wilson(r.hits, r.attempts, z);
  return { label, attempts: r.attempts, hits: r.hits, rate: w.p, lo: w.lo, hi: w.hi };
}
