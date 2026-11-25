/**
 * Killer's rules, one dart at a time. Shared by the scorer (which applies
 * a whole visit when the turn ends), its live preview of the visit in
 * progress, and the bot that needs to know mid-visit whether it is a
 * killer yet. Pure: no React, no network.
 *
 * Only doubles matter:
 *  - your own double makes you a killer;
 *  - once you are one, your own double costs you a life;
 *  - a killer's dart in another living player's double takes one of theirs.
 * A player with no lives left can do nothing more: the rest of their visit
 * is thrown away (a killer who knocks themselves out cannot take anyone
 * with them afterwards).
 */

/**
 * Apply one dart thrown by `cur` to `state` ({ lives, killer }, mutated in
 * place). Returns the events it caused, in order: `killer`, `self`, `hit`
 * and `elim` ({ t, by, on? }), an empty list when the dart changed nothing.
 */
export function applyKillerDart(state, cur, dart, { players, numbers }) {
  const events = [];
  if (!dart || dart.n === 0 || dart.mult !== 2) return events;
  if (state.lives[cur] <= 0) return events;

  if (dart.n === numbers[cur]) {
    if (!state.killer[cur]) {
      state.killer[cur] = true;
      events.push({ t: "killer", by: cur });
      return events;
    }
    state.lives[cur] = Math.max(0, state.lives[cur] - 1);
    events.push({ t: "self", by: cur });
    if (state.lives[cur] === 0) events.push({ t: "elim", by: cur, on: cur });
    return events;
  }

  if (!state.killer[cur]) return events;
  const victim = players.find((u) => u !== cur && numbers[u] === dart.n);
  if (!victim || state.lives[victim] <= 0) return events;
  state.lives[victim] = Math.max(0, state.lives[victim] - 1);
  events.push({ t: "hit", by: cur, on: victim });
  if (state.lives[victim] === 0) events.push({ t: "elim", by: cur, on: victim });
  return events;
}

/**
 * Where the game stands part-way through a visit: `state` with `darts`
 * applied, on a copy. Returns { lives, killer }.
 */
export function previewKillerVisit(state, cur, darts, ctx) {
  const next = { lives: { ...state.lives }, killer: { ...state.killer } };
  for (const d of darts || []) applyKillerDart(next, cur, d, ctx);
  return next;
}
