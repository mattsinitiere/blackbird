import { dartValue } from "../darts.js";

/** Shared helpers for the per-game analyzers. Pure. */

export const RING = { 0: "Miss", 1: "S", 2: "D", 3: "T" };

export function segmentLabel(d) {
  if (!d || d.n === 0 || d.mult === 0) return "Miss";
  if (d.n === 25) return d.mult === 2 ? "Bull" : "25";
  return `${RING[d.mult] || "S"}${d.n}`;
}

export function isMiss(d) {
  return !d || d.n === 0 || d.mult === 0;
}

export function round(n, d = 1) {
  const f = Math.pow(10, d);
  return Math.round((n || 0) * f) / f;
}

export function pct(part, whole, d = 1) {
  return whole ? round((part / whole) * 100, d) : null;
}

export function avg(sum, n, d = 1) {
  return n ? round(sum / n, d) : null;
}

export function sum(list, pick = (x) => x) {
  let t = 0;
  for (const x of list || []) t += pick(x) || 0;
  return t;
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < (list || []).length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Quality flags every analysis carries. */
export function quality({ legacy, hasVisits, hasMisses, exactLanding, hasTimes, partial, notes = [] }) {
  return { legacy: !!legacy, hasVisits: !!hasVisits, hasMisses: !!hasMisses, exactLanding: !!exactLanding, hasTimes: !!hasTimes, partial: !!partial, notes };
}

/** Flat, enriched dart list from visits. */
export function flattenVisits(visits) {
  const out = [];
  let i = 0;
  for (const v of visits || []) {
    (v.darts || []).forEach((d, pos) => {
      out.push({ n: d.n, mult: d.mult, value: dartValue(d), i: i++, visit: v.i, round: v.r, pos, t: d.t, x: d.x });
    });
  }
  return out;
}

/** Per-dart basics shared by every game: misses, position averages, landing distribution. */
export function perDartBasics(darts, { exactLanding }) {
  const misses = darts.filter(isMiss).length;
  const byPosition = [0, 1, 2].map((p) => {
    const at = darts.filter((d) => d.pos === p);
    return avg(sum(at, (d) => d.value), at.length);
  });
  let bySegment = null;
  if (exactLanding) {
    bySegment = {};
    for (const d of darts) {
      const k = segmentLabel(d);
      bySegment[k] = (bySegment[k] || 0) + 1;
    }
  }
  return { misses, missPct: pct(misses, darts.length), byPosition, bySegment };
}

/** true when at least one dart carries a throw time */
export function hasTimes(visits) {
  return (visits || []).some((v) => (v.darts || []).some((d) => typeof d.t === "number"));
}

/** Visits that a v2 row stored, or null when the row predates v2. */
export function storedVisits(pp) {
  return pp && pp.v >= 2 && Array.isArray(pp.visits) && pp.visits.length && typeof pp.visits[0] === "object" ? pp.visits : null;
}

export function series(values, dateless = true) {
  return (values || []).map((y, i) => ({ x: i + 1, y }));
}

export function baseAnalysis({ gameType, pp, username, winner, quality: q, visits, rounds, totals, perDart, metrics, seriesOut }) {
  return {
    gameType,
    version: pp && pp.v >= 2 ? 2 : 1,
    username: username || null,
    won: username != null && winner != null ? winner === username : null,
    quality: q,
    darts: flattenVisits(visits),
    visits: visits || [],
    rounds: rounds || [],
    totals: totals || {},
    perDart: perDart || {},
    metrics: metrics || {},
    series: seriesOut || {},
  };
}
