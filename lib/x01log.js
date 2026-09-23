import { dartValue } from "./darts.js";

/**
 * Replay one player's X01 dart log (the `darts` array saved per game) with
 * the same rules PlayX01 uses, and derive the finishing and scoring stats
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

/**
 * @param {Array<{n:number, mult:number}>} log
 * @param {number} startScore
 * @param {boolean} doubleOut
 */
export function replayX01Log(log, startScore, doubleOut) {
  const out = {
    valid: false,
    dartsThrown: 0,
    pointsScored: 0,
    visits: 0,
    busts: 0,
    tons: 0, // visits of 100+
    ton40s: 0, // visits of 140+
    one80s: 0,
    highestTurn: 0,
    first9: null, // points in the first nine darts
    chances: 0, // darts thrown at a finish
    chancesByRange: { "2-40": 0, "41-70": 0, "71-100": 0, "101-170": 0 }, // by the score the visit started on
    checkoutHit: 0, // 1 if the leg was finished from this log
    checkoutScore: 0,
    threeDartAvg: 0,
  };
  if (!Array.isArray(log) || !log.length || !(startScore > 0)) return out;
  out.valid = true;
  const isFinish = doubleOut ? isDoubleFinish : isSingleDartFinish;

  let score = startScore;
  let visit = [];
  let first9 = 0;
  let dartsSeen = 0;

  const endVisit = (kind) => {
    const sum = visit.reduce((a, d) => a + dartValue(d), 0);
    out.visits++;
    if (kind === "bust") {
      out.busts++;
    } else {
      score -= sum;
      out.pointsScored += sum;
      out.highestTurn = Math.max(out.highestTurn, sum);
      if (sum >= 100) out.tons++;
      if (sum >= 140) out.ton40s++;
      if (sum === 180) out.one80s++;
    }
    visit = [];
  };

  for (const d of log) {
    if (!d || typeof d.n !== "number") continue;
    const visitStart = score;
    const before = visitStart - visit.reduce((a, x) => a + dartValue(x), 0);
    if (isFinish(before)) {
      out.chances++;
      out.chancesByRange[checkoutRange(visitStart)]++;
    }
    visit.push(d);
    out.dartsThrown++;
    dartsSeen++;
    if (dartsSeen <= 9) first9 += dartValue(d);
    const rem = before - dartValue(d);
    if (rem < 0) {
      endVisit("bust");
      continue;
    }
    if (rem === 0) {
      if (!doubleOut || d.mult === 2) {
        out.checkoutHit = 1;
        out.checkoutScore = visitStart;
        endVisit("win");
        break;
      }
      endVisit("bust");
      continue;
    }
    if (doubleOut && rem === 1) {
      endVisit("bust");
      continue;
    }
    if (visit.length === 3) endVisit("normal");
  }
  // a trailing partial visit (the other player finished first) still scored
  if (visit.length) {
    const sum = visit.reduce((a, d) => a + dartValue(d), 0);
    out.visits++;
    out.pointsScored += sum;
    out.highestTurn = Math.max(out.highestTurn, sum);
    visit = [];
  }
  if (dartsSeen >= 9) out.first9 = first9;
  out.threeDartAvg = out.dartsThrown ? Math.round(((out.pointsScored / out.dartsThrown) * 3) * 10) / 10 : 0;
  return out;
}

/** Bucket a checkout (or a chance's remaining score) into the usual ranges. */
export function checkoutRange(score) {
  if (score <= 40) return "2-40";
  if (score <= 70) return "41-70";
  if (score <= 100) return "71-100";
  return "101-170";
}
