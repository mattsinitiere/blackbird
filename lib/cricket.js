import { X01_TARGETS, CRICKET_VALUE } from "./constants.js";

/**
 * Cricket rules shared by PlayCricket and the tests: applying a visit's darts,
 * and deciding when the game is over and who won. Pure: no React, no network.
 */

const numOf = (t) => (t === "B" ? 25 : Number(t));

export const cricketAllClosed = (marks) => X01_TARGETS.every((t) => (marks?.[t] || 0) >= 3);

/** A fresh per-player cricket state. */
export const blankCricketPlayer = () => ({
  marks: { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, B: 0 },
  points: 0,
  markCount: 0,
  rounds: 0,
  roundMarks: [],
  log: [],
});

/**
 * Apply one visit's darts for `cur`, mutating `ns` (the per-player map).
 * Darts are { target: "20".."15" | "B" | "M", ring, land?, t? }; "M" is a miss.
 * Returns the visit's marks, dead marks and the recorder darts.
 */
export function applyCricketVisit(ns, cur, darts, { players, variant }) {
  const me = ns[cur];
  if (!me.roundMarks) me.roundMarks = []; // resumed games saved before per-round tracking
  let roundMarks = 0;
  let dead = 0;
  const recDarts = [];

  for (const dt of darts) {
    if (dt.target === "M") {
      // a miss: the real landing when a bot threw it, else unknown (0/0)
      const land = dt.land ? { n: dt.land.n, mult: dt.land.mult } : { n: 0, mult: 0 };
      me.log.push(land);
      recDarts.push({ ...land, t: dt.t, x: { m: 0 } });
      continue;
    }
    const before = me.marks[dt.target];
    const after = before + dt.ring;
    const anyOpen = players.some((o) => o !== cur && ns[o].marks[dt.target] < 3);
    me.marks[dt.target] = after;
    me.log.push({ n: numOf(dt.target), mult: dt.ring });
    // Standard MPR: hits that advance your close always count; extra hits
    // count only when they can score (an opponent still has the number open).
    // Dead darts (everyone closed / no-score variant surplus) count 0.
    const closingHits = Math.min(after, 3) - Math.min(before, 3);
    const scoringHits = Math.max(0, after - 3) - Math.max(0, before - 3);
    const liveScoring = variant !== "noscore" && anyOpen ? scoringHits : 0;
    me.markCount += closingHits + liveScoring;
    roundMarks += closingHits + liveScoring;
    dead += dt.ring - (closingHits + liveScoring);
    recDarts.push({ n: numOf(dt.target), mult: dt.ring, t: dt.t, x: { m: closingHits + liveScoring } });
    if (scoringHits > 0) {
      const value = CRICKET_VALUE[dt.target] * scoringHits;
      if (variant === "noscore") {
        // no points
      } else if (variant === "cutthroat") {
        players.forEach((o) => {
          if (o !== cur && ns[o].marks[dt.target] < 3) ns[o].points += value;
        });
      } else if (anyOpen) {
        me.points += value;
      }
    }
  }
  me.rounds += 1;
  me.roundMarks.push(roundMarks);
  return { roundMarks, dead, recDarts };
}

/**
 * The winner once `cur` has ended a visit, or null while the game goes on.
 * - No-score: the first to close every number.
 * - Score: closed every number and level with or ahead of everyone on points.
 * - Cutthroat: closed every number and level with or below everyone on points
 *   (points are bad). A player who closed out with the highest score plays
 *   on until the others' points catch up. Any closed player can win at the
 *   end of someone else's visit, since that visit can raise the others.
 */
const onTop = (ns, players, variant, u) =>
  variant === "noscore" ||
  players.every((o) => o === u || (variant === "cutthroat" ? ns[u].points <= ns[o].points : ns[u].points >= ns[o].points));

export function cricketWinner(ns, { players, variant, cur }) {
  const better = (u) => onTop(ns, players, variant, u);
  // the thrower first, so a tie between two closed players goes to the visit's thrower
  const order = [cur, ...players.filter((u) => u !== cur)];
  const candidates = variant === "cutthroat" ? order : [cur];
  return candidates.find((u) => cricketAllClosed(ns[u].marks) && better(u)) || null;
}

/** Players who have closed every number but can't win yet on points. */
export function cricketClosedNotWinning(ns, { players, variant }) {
  return players.filter((u) => cricketAllClosed(ns[u].marks) && !onTop(ns, players, variant, u));
}

/**
 * End turn guard: a visit needs at least one dart entered (Miss counts), and
 * a tap within END_TURN_GUARD_MS of the last turn ending is a double tap.
 */
export const END_TURN_GUARD_MS = 400;
export function canEndTurn(dartCount, lastEndAt, now) {
  if (dartCount < 1) return false;
  return !(lastEndAt && now - lastEndAt < END_TURN_GUARD_MS);
}
