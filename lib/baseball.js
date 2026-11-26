import { BASEBALL_INNINGS } from "./constants.js";

/**
 * Baseball turn order and result, shared by PlayBaseball and the tests.
 * Pure: no React, no network.
 *
 * `turn` counts visits through the plain rotation (inning = turn / players
 * + 1). Nine innings are played by everyone. If the lead is shared after
 * nine, only the tied leaders play extra innings; everyone else's total is
 * final and their turns are skipped. Each extra inning drops anyone who
 * falls behind, until one leader is left.
 */

const runsThrough = (st, innings) => (st?.innings || []).slice(0, innings).reduce((a, r) => a + r, 0);

/** Who throws in `inning`: everyone in regulation, then the tied leaders. */
export function baseballContenders(state, players, inning) {
  if (inning <= BASEBALL_INNINGS) return players;
  const totals = players.map((u) => runsThrough(state[u], inning - 1));
  const max = Math.max(...totals);
  return players.filter((u, i) => totals[i] === max);
}

export const baseballInning = (turn, players) => Math.floor(turn / players.length) + 1;

/**
 * After the visit at `turn` was scored into `state`: either the game is over
 * ({ done: true, winner }) or the next visit's turn ({ done: false, turn }),
 * skipping players who are out of the extra innings.
 */
export function baseballAfterVisit(state, players, turn) {
  const n = players.length;
  const inning = baseballInning(turn, players);
  let next = turn + 1;
  for (;;) {
    const nextInning = baseballInning(next, players);
    if (nextInning > inning && inning >= BASEBALL_INNINGS) {
      // the inning is over: one leader left wins
      const leaders = baseballContenders(state, players, inning + 1);
      if (leaders.length === 1) return { done: true, winner: leaders[0] };
    }
    if (baseballContenders(state, players, nextInning).includes(players[next % n])) return { done: false, turn: next };
    next += 1;
  }
}
