/**
 * Killer's rules, one dart at a time. Shared by the scorer (which applies
 * a whole visit when the turn ends), its live preview of the visit in
 * progress (the cards follow each dart as it lands), and the bot that
 * needs to know mid-visit whether it is a killer yet. Pure: no React, no
 * network.
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

/** Everyone still standing in `state`, in throw order. */
export function killerAlive(state, players) {
  return players.filter((u) => state.lives[u] > 0);
}

/**
 * Whether a visit is over after these darts: three thrown, the thrower
 * knocked themselves out (the rest would count for nothing), or the last
 * one left a single player standing (the game ends on that dart, without
 * waiting for End turn).
 */
export function killerVisitOver(state, cur, darts, ctx) {
  if ((darts || []).length >= 3) return true;
  const next = previewKillerVisit(state, cur, darts, ctx);
  return next.lives[cur] <= 0 || killerAlive(next, ctx.players).length <= 1;
}

/**
 * What a visit did, in a few words, from the events applyKillerDart
 * returned for it: "no effect", "became a killer", "took 1 of your
 * lives", "knocked out Lindsey" and so on. `me` turns lives taken from
 * that player into "your"; `label` names players.
 */
export function describeKillerVisit(events, { me = null, label = (u) => u } = {}) {
  const evs = events || [];
  if (!evs.length) return "no effect";
  const parts = [];
  if (evs.some((e) => e.t === "killer")) parts.push("became a killer");
  const hits = new Map();
  for (const e of evs) if (e.t === "hit") hits.set(e.on, (hits.get(e.on) || 0) + 1);
  for (const [on, n] of hits) {
    const out = evs.some((e) => e.t === "elim" && e.on === on);
    if (on === me) parts.push(out ? "knocked you out" : `took ${n} of your lives`);
    else parts.push(out ? `knocked out ${label(on)}` : `took ${n === 1 ? "a life" : `${n} lives`} from ${label(on)}`);
  }
  const self = evs.filter((e) => e.t === "self").length;
  if (self) {
    const out = evs.some((e) => e.t === "elim" && e.on === e.by);
    parts.push(out ? "knocked themselves out" : `lost ${self === 1 ? "a life" : `${self} lives`} on their own double`);
  }
  return parts.join(", ");
}
