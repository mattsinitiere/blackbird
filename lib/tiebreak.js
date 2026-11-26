import { dartValue } from "./darts.js";

/**
 * Sudden-death tiebreak for the score games (Shanghai, Halve It). When the
 * last round ends with the top score shared, the game is not over: the
 * tied leaders each throw one more visit, in throw order, and the highest
 * three-dart total (any segment, scored like X01) wins. Whoever is still
 * level at the top goes again; everyone else is out of the tiebreak.
 *
 * This keeps every finished game with exactly one winner, so the result
 * rows (game_results.winner is NOT NULL) and Elo, which only knows
 * winner vs loser, stay valid. Pure: no React, no network.
 *
 * Tiebreak state: { players, i, round, totals: { [u]: [visit totals] } }
 *   players  who is still in the tiebreak, in throw order
 *   i        index into `players` of who throws next
 *   round    tiebreak round, from 0
 */

/** Everyone sharing the top score, in throw order. */
export function topScorers(scores, players) {
  const max = Math.max(...players.map((u) => scores[u] ?? 0));
  return players.filter((u) => (scores[u] ?? 0) === max);
}

/** A tiebreak for these tied leaders, or null when one player leads outright. */
export function startTiebreak(leaders) {
  if (!leaders || leaders.length < 2) return null;
  return { players: [...leaders], i: 0, round: 0, totals: Object.fromEntries(leaders.map((u) => [u, []])) };
}

/** Who throws the next tiebreak visit. */
export function tiebreakThrower(tb) {
  return tb ? tb.players[tb.i] : null;
}

/** A tiebreak visit's total: every dart counts at face value. */
export function tiebreakScore(darts) {
  return (darts || []).reduce((a, d) => a + dartValue(d), 0);
}

/**
 * Record the current thrower's visit. Returns { tb, winner }: the winner
 * once a full round has one player ahead, else null with the next state
 * (the same round continuing, or a new round for those still level).
 */
export function addTiebreakVisit(tb, darts) {
  const u = tb.players[tb.i];
  const totals = { ...tb.totals, [u]: [...(tb.totals[u] || []), tiebreakScore(darts)] };
  const i = tb.i + 1;
  if (i < tb.players.length) return { tb: { ...tb, i, totals }, winner: null };
  const last = Object.fromEntries(tb.players.map((p) => [p, totals[p][totals[p].length - 1]]));
  const top = topScorers(last, tb.players);
  if (top.length === 1) return { tb: { ...tb, i, totals }, winner: top[0] };
  return { tb: { players: top, i: 0, round: tb.round + 1, totals }, winner: null };
}
