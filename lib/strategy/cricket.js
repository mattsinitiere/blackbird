/**
 * Cricket advice for the player at the oche. Deterministic rules of thumb,
 * no probabilities. Variants follow components/PlayCricket.js:
 * - standard:  extra hits on a number you have closed score for YOU while
 *              any opponent still has it open; win = all closed and not
 *              behind on points.
 * - cutthroat: extra hits score for every OPPONENT who has it open; lowest
 *              points wins once someone has closed everything.
 * - noscore:   no points at all; first to close everything wins.
 *
 * Priority (standard and cutthroat):
 *   1. defend: an opponent has closed a number you still have open (they can
 *      score on it — for you in cutthroat, for them in standard): close the
 *      highest such number;
 *   2. catch up: you are behind on points and have a closed number an
 *      opponent still has open: score on the highest such number;
 *   3. close your highest open number (20 down to 15, then the bull);
 *   4. everything closed and not behind (or nowhere left to score): "done".
 * No-score: close the highest open number; never "score".
 *
 * state: { [username]: { marks: { 20, 19, 18, 17, 16, 15, B }, points } }
 */

export const CRICKET_TARGETS = ["20", "19", "18", "17", "16", "15", "B"];

const closed = (p, t) => ((p?.marks?.[t]) || 0) >= 3;
const pts = (p) => p?.points || 0;

/**
 * @param {{ variant?: "standard"|"cutthroat"|"noscore", me: string, players: string[], state: object }} input
 * @returns {{ action: "close"|"score"|"bull"|"done", target: string|null, reason: string, basis: "standard" }}
 */
export function recommendCricket({ variant = "standard", me, players, state } = {}) {
  const out = (action, target, reason) => ({ action, target, reason, basis: "standard" });
  const mine = state?.[me];
  if (!mine) return out("done", null, "No state for this player.");
  const others = (players || Object.keys(state)).filter((u) => u !== me && state[u]?.marks).map((u) => state[u]);
  const open = CRICKET_TARGETS.filter((t) => !closed(mine, t));
  const closeAt = (t, why) => (t === "B" ? out("bull", "B", why || "Close the bull.") : out("close", t, why || `Close ${t}, your highest open number.`));
  const name = (t) => (t === "B" ? "the bull" : t);

  if (variant === "noscore") {
    if (!open.length) return out("done", null, "Everything is closed.");
    return closeAt(open[0], open[0] === "B" ? "Only the bull is left to close." : undefined);
  }

  const cut = variant === "cutthroat";
  const best = others.length ? (cut ? Math.min(...others.map(pts)) : Math.max(...others.map(pts))) : pts(mine);
  const behind = cut ? pts(mine) > best : pts(mine) < best;
  const threats = open.filter((t) => others.some((o) => closed(o, t)));
  const chances = CRICKET_TARGETS.filter((t) => closed(mine, t) && others.some((o) => !closed(o, t)));

  if (threats.length) {
    const t = threats[0];
    return closeAt(t, cut ? `Close ${name(t)}: an opponent has it closed and can pile points on you.` : `Close ${name(t)}: an opponent has it closed and can score on it.`);
  }
  if (behind && chances.length) {
    const t = chances[0];
    return out("score", t, cut ? `You have more points: score on ${name(t)} to add to opponents who have it open.` : `You are behind: score on ${name(t)}, closed for you and open for an opponent.`);
  }
  if (open.length) return closeAt(open[0], open[0] === "B" ? "Every number is closed: go for the bull." : undefined);
  return out("done", null, "Everything is closed.");
}
