import { dartValue } from "./darts.js";

/**
 * Replay one player's X01 dart log (the flat `darts` array saved per game)
 * with the same rules PlayX01 uses, recovering the visit boundaries the app
 * never stored before stats v2, and derive the finishing and scoring stats
 * the app never stored explicitly: darts thrown at a finish, checkout
 * success, busts, 100+/140+/180 visits and the first-nine average.
 *
 * Definitions (the standard TV ones):
 * - A "checkout chance" is one dart thrown while the remaining score could
 *   be finished with that single dart: an even number up to 40 or bull (50)
 *   when playing double out, any one-dart score when playing straight out.
 * - Checkout % = checkouts hit / checkout chances × 100.
 *
 * Pure: no React, no network. Safe on legacy rows without a log.
 */

export function isDoubleFinish(rem) {
  return (rem >= 2 && rem <= 40 && rem % 2 === 0) || rem === 50;
}

export function isSingleDartFinish(rem) {
  if (rem < 1 || rem > 60) return false;
  return rem <= 20 || (rem <= 40 && rem % 2 === 0) || rem % 3 === 0 || rem === 25 || rem === 50;
}

export function isFinishable(rem, doubleOut) {
  return doubleOut ? isDoubleFinish(rem) : isSingleDartFinish(rem);
}

/**
 * Rebuild the visits of one leg from a flat log, in the stats v2 shape:
 * [{ i, r: 0, s0, darts: [{n, mult}], out: { k: "score"|"bust"|"win", s, rem } }].
 * A trailing partial visit (the log ended mid-visit) is kept as "score".
 */
export function replayX01Visits(log, startScore, doubleOut, r = 0) {
  const visits = [];
  if (!Array.isArray(log) || !log.length || !(startScore > 0)) return visits;
  let score = startScore;
  let visit = [];
  const push = (k) => {
    const s = visit.reduce((a, d) => a + dartValue(d), 0);
    const s0 = score;
    if (k !== "bust") score -= s;
    visits.push({ i: visits.length, r, s0, darts: visit, out: { k, s: k === "bust" ? 0 : s, rem: score } });
    visit = [];
  };
  for (const d of log) {
    if (!d || typeof d.n !== "number") continue;
    const before = score - visit.reduce((a, x) => a + dartValue(x), 0);
    visit.push({ n: d.n, mult: d.mult });
    const rem = before - dartValue(d);
    if (rem < 0) {
      push("bust");
      continue;
    }
    if (rem === 0) {
      if (!doubleOut || d.mult === 2) {
        push("win");
        break;
      }
      push("bust");
      continue;
    }
    if (doubleOut && rem === 1) {
      push("bust");
      continue;
    }
    if (visit.length === 3) push("score");
  }
  if (visit.length) push("score");
  return visits;
}

/**
 * Finishing and scoring numbers for one leg's visits (v2 or replayed).
 */
export function summarizeX01Visits(visits, doubleOut) {
  const out = {
    valid: visits.length > 0,
    dartsThrown: 0,
    pointsScored: 0,
    visits: visits.length,
    busts: 0,
    tons: 0, // visits of 100+
    ton40s: 0, // visits of 140+
    one80s: 0,
    highestTurn: 0,
    first9: null, // points in the first nine darts, busts included
    chances: 0, // darts thrown at a finish
    chancesByRange: { "2-40": 0, "41-70": 0, "71-100": 0, "101-170": 0 }, // by the score the visit started on
    checkoutHit: 0,
    checkoutScore: 0,
    threeDartAvg: 0,
  };
  let dartsSeen = 0;
  let first9 = 0;
  for (const v of visits) {
    let rem = v.s0;
    for (const d of v.darts || []) {
      if (isFinishable(rem, doubleOut)) {
        out.chances++;
        out.chancesByRange[checkoutRange(v.s0)]++;
      }
      out.dartsThrown++;
      dartsSeen++;
      if (dartsSeen <= 9) first9 += dartValue(d);
      rem -= dartValue(d);
    }
    const k = v.out?.k;
    if (k === "bust") {
      out.busts++;
    } else {
      const s = v.out?.s ?? (v.darts || []).reduce((a, d) => a + dartValue(d), 0);
      out.pointsScored += s;
      out.highestTurn = Math.max(out.highestTurn, s);
      if (s >= 100) out.tons++;
      if (s >= 140) out.ton40s++;
      if (s === 180) out.one80s++;
      if (k === "win") {
        out.checkoutHit = 1;
        out.checkoutScore = v.s0;
      }
    }
  }
  if (dartsSeen >= 9) out.first9 = first9;
  out.threeDartAvg = out.dartsThrown ? Math.round(((out.pointsScored / out.dartsThrown) * 3) * 10) / 10 : 0;
  return out;
}

/**
 * @param {Array<{n:number, mult:number}>} log
 * @param {number} startScore
 * @param {boolean} doubleOut
 */
export function replayX01Log(log, startScore, doubleOut) {
  return summarizeX01Visits(replayX01Visits(log, startScore, doubleOut), doubleOut);
}

/** Bucket a checkout (or a chance's remaining score) into the usual ranges. */
export function checkoutRange(score) {
  if (score <= 40) return "2-40";
  if (score <= 70) return "41-70";
  if (score <= 100) return "71-100";
  return "101-170";
}
