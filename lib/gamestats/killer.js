import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, isMiss } from "./common.js";

/**
 * Killer analyzer. v2 rows carry the whole-game event log (who became a
 * killer, who hit whom, eliminations); legacy rows know only the totals.
 */
export function analyzeKiller(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  const visits = stored || [];
  const events = Array.isArray(pp?.events) ? pp.events : [];
  const darts = flattenVisits(visits);
  const myNumber = config?.numbers?.[username] ?? null;
  const notes = [];
  if (legacy) notes.push("turn boundaries and events were not recorded before stats v2");

  let dartsToBecomeKiller = null;
  if (visits.length && myNumber != null) {
    let n = 0;
    outer: for (const v of visits) {
      for (const d of v.darts || []) {
        n++;
        if (d.n === myNumber && d.mult === 2) {
          dartsToBecomeKiller = n;
          break outer;
        }
      }
    }
  }
  const mine = events.filter((e) => e.by === username);
  const onMe = events.filter((e) => e.on === username);
  const elim = onMe.find((e) => e.t === "elim");
  const doubles = darts.filter((d) => !isMiss(d) && d.mult === 2).length;
  const metrics = {
    livesRemaining: pp?.livesRemaining ?? null,
    isKiller: pp?.isKiller ?? null,
    number: myNumber,
    dartsToBecomeKiller,
    kills: events.length ? mine.filter((e) => e.t === "elim").length : null,
    livesTaken: events.length ? mine.filter((e) => e.t === "hit").length : null,
    livesLost: events.length ? onMe.filter((e) => e.t === "hit").length + mine.filter((e) => e.t === "self").length : null,
    selfHits: events.length ? mine.filter((e) => e.t === "self").length : null,
    eliminatedBy: elim ? elim.by : null,
    survivedTurns: visits.length || null,
    doubleHitRate: darts.length ? pct(doubles, darts.length) : null,
    missPct: darts.length ? pct(darts.filter(isMiss).length, darts.length) : null,
  };
  const rounds = visits.map((v) => ({ r: v.r, label: `Turn ${v.i + 1}`, livesBefore: v.s0?.l ?? null, livesAfter: v.out?.l ?? null, killer: v.out?.k ?? null, events: v.out?.ev ?? 0 }));
  // lives at the end of every round of the game, not just this player's
  // own visits: most lives are lost on someone else's turn
  const lives = livesByRound({ events, visits, config, username, elim }) || rounds.map((r, i) => ({ x: i + 1, y: r.livesAfter }));
  return baseAnalysis({
    gameType: "killer",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: visits.length > 0, exactLanding: true, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, turns: visits.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: true }),
    metrics,
    seriesOut: { lives },
  });
}

/**
 * A player's lives from the start through the end of each round, replayed
 * from the whole-game event log, ending on 0 in the round they went out.
 * Rounds are counted in the fixed throw order (turn / number of players),
 * as the scorer records them. Null when the log can't say (legacy rows).
 */
export function livesByRound({ events, visits = [], config, username, elim = null }) {
  const n = Object.keys(config?.numbers || {}).length;
  if (!events?.length || !n || username == null) return null;
  const start = config?.lives || 3;
  const roundOf = (e) => Math.floor((e.turn ?? 0) / n);
  const lost = events.filter((e) => (e.t === "hit" && e.on === username) || (e.t === "self" && e.by === username));
  const last = Math.max(0, ...events.map(roundOf), ...visits.map((v) => v.r ?? 0));
  const end = elim ? roundOf(elim) : last;
  const out = [{ x: 1, y: start, label: "Start" }];
  for (let r = 0; r <= end; r++) {
    const down = lost.filter((e) => roundOf(e) <= r).length;
    out.push({ x: r + 2, y: Math.max(0, start - down), label: `Round ${r + 1}` });
  }
  return out;
}
