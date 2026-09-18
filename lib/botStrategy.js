import { getCheckoutPath, isCheckoutRange, parseCheckout } from "./checkouts.js";
import { aimPoint } from "./board.js";
import { throwAt } from "./simulator.js";

/**
 * What a bot aims at, per game. Each picker returns a target { n, mult }
 * (n 25 = bull, mult 2 = inner bull); `botThrow` turns that into a
 * landing via the simulator. Pure: randomness only through `rng`.
 */

const T20 = { n: 20, mult: 3 };
const S20 = { n: 20, mult: 1 };

/**
 * X01. Double-out: throw the out-chart when a finish is on, except that a
 * bot only "knows" the right setup shot with probability `checkout` when
 * more than 40 is left; otherwise it just scores. Straight-in: score
 * until a single dart can finish, then take it.
 */
export function pickX01Target({ remaining, doubleOut = true, checkout = 1 }, rng = Math.random) {
  if (doubleOut) {
    if (remaining > 170 || !isCheckoutRange(remaining)) return T20; // 159–169 bogeys: T20 is always safe from 159
    const path = parseCheckout(getCheckoutPath(remaining));
    if (remaining > 40 && rng() > checkout) return remaining > 100 ? T20 : S20;
    return path[0] || T20;
  }
  // straight in
  if (remaining > 60) return T20;
  if (remaining === 50) return { n: 25, mult: 2 };
  if (remaining === 25) return { n: 25, mult: 1 };
  if (remaining <= 20) return { n: remaining, mult: 1 };
  if (remaining % 2 === 0 && remaining <= 40) return { n: remaining / 2, mult: 2 };
  if (remaining % 3 === 0) return { n: remaining / 3, mult: 3 };
  // not finishable in one: leave something that is
  return S20;
}

/**
 * Cricket. Close your highest open number first (aim its triple, inner
 * bull for B). Once everything is closed, hit a number an opponent still
 * has open: in standard play that scores for you, in cutthroat it scores
 * against them. Returns null when there is nothing useful to hit.
 */
export function pickCricketTarget({ variant = "standard", marks, others = [] }) {
  const targets = ["20", "19", "18", "17", "16", "15", "B"];
  const aim = (t) => (t === "B" ? { n: 25, mult: 2 } : { n: Number(t), mult: 3 });
  const open = targets.find((t) => (marks[t] || 0) < 3);
  if (open) return aim(open);
  if (variant === "noscore") return null;
  const scoring = targets.find((t) => others.some((o) => (o[t] || 0) < 3));
  return scoring ? aim(scoring) : null;
}

/** Baseball: the triple of the inning's number. */
export function pickBaseballTarget(target) {
  return { n: target, mult: 3 };
}

/** Throw at a target with the bot's accuracy. Returns the landing { n, mult, x, y }. */
export function botThrow(bot, target, rng = Math.random) {
  return throwAt(aimPoint(target.n, target.mult), bot.sigma, rng);
}
