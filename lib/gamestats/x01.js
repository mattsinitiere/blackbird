import { dartValue } from "../darts.js";
import { replayX01Visits, summarizeX01Visits, checkoutRange } from "../x01log.js";
import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, avg, round, sum } from "./common.js";

/**
 * X01 analyzer. Works on stats v2 rows (stored visits, legs) and legacy rows
 * (flat dart log, replayed with the game rules). One leg per round index.
 */
export function x01Config(config) {
  const c = config || {};
  return { start: c.startScore || c.start || 501, doubleOut: !!c.doubleOut, legs: c.legs > 1 ? c.legs : 1 };
}

export function analyzeX01(pp, config, { username, winner } = {}) {
  const { start, doubleOut } = x01Config(config);
  const stored = storedVisits(pp);
  const legacy = !stored;
  const notes = [];

  let visits;
  let legs;
  if (stored) {
    visits = stored;
    legs = Array.isArray(pp.legs) && pp.legs.length ? pp.legs : [{ w: winner ?? null, d: pp.dartsThrown || 0, co: pp.checkout || 0, s0: start }];
  } else {
    visits = replayX01Visits(pp?.darts, start, doubleOut);
    legs = [{ w: winner ?? null, d: pp?.dartsThrown || visits.reduce((a, v) => a + v.darts.length, 0), co: pp?.checkout || 0, s0: start }];
    if (!visits.length) notes.push("no dart log: only totals are known");
    if ((config?.legs || 1) > 1) notes.push("best-of match recorded before stats v2: only the final leg is logged");
  }

  // per leg
  const legIdx = [...new Set(visits.map((v) => v.r || 0))].sort((a, b) => a - b);
  const rounds = legIdx.map((r) => {
    const lv = visits.filter((v) => (v.r || 0) === r);
    const s = summarizeX01Visits(lv, doubleOut);
    const meta = legs[r] || legs[legs.length - 1] || {};
    return { r, label: `Leg ${r + 1}`, darts: s.dartsThrown, points: s.pointsScored, avg: s.threeDartAvg, first9: s.first9 != null ? round(s.first9 / 3, 1) : null, won: meta.w != null && username != null ? meta.w === username : s.checkoutHit === 1, checkout: s.checkoutScore || 0, busts: s.busts, tons: s.tons, ton40s: s.ton40s, one80s: s.one80s, chances: s.chances, chancesByRange: s.chancesByRange, checkoutHit: s.checkoutHit, highestTurn: s.highestTurn, visits: lv.length };
  });
  if (!rounds.length && pp) {
    rounds.push({ r: 0, label: "Leg 1", darts: pp.dartsThrown || 0, points: pp.pointsScored || 0, avg: pp.dartsThrown ? round((pp.pointsScored / pp.dartsThrown) * 3, 1) : null, first9: null, won: winner === username, checkout: pp.checkout || 0, busts: null, tons: null, ton40s: null, one80s: null, chances: null, chancesByRange: null, checkoutHit: winner === username ? 1 : 0, highestTurn: pp.highestTurn || 0, visits: 0 });
  }

  const darts = flattenVisits(visits);
  const dartsThrown = visits.length ? darts.length : pp?.dartsThrown || 0;
  const points = visits.length ? sum(rounds, (l) => l.points) : pp?.pointsScored || 0;
  const scored = visits.filter((v) => v.out?.k !== "bust");
  const visitSums = scored.map((v) => v.out?.s ?? sum(v.darts, dartValue));
  const chances = sum(rounds, (l) => l.chances);
  const hits = sum(rounds, (l) => l.checkoutHit);
  const chancesByRange = { "2-40": 0, "41-70": 0, "71-100": 0, "101-170": 0 };
  const hitsByRange = { "2-40": 0, "41-70": 0, "71-100": 0, "101-170": 0 };
  for (const l of rounds) {
    if (l.chancesByRange) for (const k in chancesByRange) chancesByRange[k] += l.chancesByRange[k] || 0;
    if (l.checkoutHit && l.checkout) hitsByRange[checkoutRange(l.checkout)]++;
  }
  const first9Legs = rounds.filter((l) => l.first9 != null);
  const wonLegs = rounds.filter((l) => l.won);
  const buckets = { "0-39": 0, "40-59": 0, "60-99": 0, "100+": 0 };
  for (const s of visitSums) buckets[s < 40 ? "0-39" : s < 60 ? "40-59" : s < 100 ? "60-99" : "100+"]++;
  const twenties = darts.filter((d) => d.n === 20 && d.mult > 0).length;
  const t20s = darts.filter((d) => d.n === 20 && d.mult === 3).length;

  const basics = perDartBasics(darts, { exactLanding: true });
  // legacy rows kept per-position sums the same way (bust darts count 0)
  if (!visits.length && Array.isArray(pp?.dartPos)) basics.byPosition = pp.dartPos.map((p) => (p && p.count ? round(p.sum / p.count, 1) : null));
  const timed = hasTimes(visits);
  const durationMs = pp?.durationMs ?? null;

  const metrics = {
    threeDartAvg: dartsThrown ? round((points / dartsThrown) * 3, 1) : null,
    first9Avg: first9Legs.length ? round(sum(first9Legs, (l) => l.first9) / first9Legs.length, 1) : null,
    perVisitAvg: avg(sum(visitSums), visitSums.length),
    byPosition: basics.byPosition,
    highestTurn: visits.length ? Math.max(0, ...rounds.map((l) => l.highestTurn)) : pp?.highestTurn || 0,
    tons: visits.length ? sum(rounds, (l) => l.tons) : null,
    ton40s: visits.length ? sum(rounds, (l) => l.ton40s) : null,
    one80s: visits.length ? sum(rounds, (l) => l.one80s) : pp?.highestTurn === 180 ? 1 : null,
    tonRate: visits.length ? pct(sum(rounds, (l) => l.tons), scored.length) : null,
    busts: visits.length ? sum(rounds, (l) => l.busts) : null,
    bustRate: visits.length ? pct(sum(rounds, (l) => l.busts), visits.length) : null,
    // the replayed finish (the score the winning visit started on) wins over
    // a stored value; they agree on real rows
    checkout: winner === username ? (wonLegs.length ? wonLegs[wonLegs.length - 1].checkout : 0) || pp?.checkout || 0 : 0,
    checkoutChances: visits.length ? chances : null,
    checkoutHits: visits.length ? hits : null,
    checkoutPct: visits.length ? pct(hits, chances) : null,
    chancesByRange: visits.length ? chancesByRange : null,
    hitsByRange: visits.length ? hitsByRange : null,
    legsWon: wonLegs.length,
    legsPlayed: rounds.length,
    avgDartsPerLeg: avg(sum(rounds, (l) => l.darts), rounds.length),
    bestLeg: wonLegs.length ? Math.min(...wonLegs.map((l) => l.darts)) : null,
    twentyBedPct: darts.length ? pct(twenties, darts.length) : null,
    trebleTwentyPct: darts.length ? pct(t20s, darts.length) : null,
    missPct: darts.length ? basics.missPct : null,
    visitBuckets: visits.length ? buckets : null,
    bestVisit: visitSums.length ? Math.max(...visitSums) : null,
    worstVisit: visitSums.length ? Math.min(...visitSums) : null,
    secondsPerVisit: durationMs && visits.length ? round(durationMs / 1000 / visits.length, 1) : null,
  };

  const seriesOut = {
    visitScores: scored.map((v, i) => ({ x: i + 1, y: v.out?.s ?? sum(v.darts, dartValue) })),
    remaining: visits.map((v, i) => ({ x: i + 1, y: v.out?.rem ?? v.s0, label: `L${(v.r || 0) + 1}` })),
    legAvg: rounds.map((l) => ({ x: l.r + 1, y: l.avg, label: l.label })),
  };

  return baseAnalysis({
    gameType: "x01",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: true, hasTimes: timed, partial: !!pp?.partial, notes }),
    visits,
    rounds,
    totals: { dartsThrown, points, visits: visits.length, legs: rounds.length, durationMs },
    perDart: basics,
    metrics,
    seriesOut,
  });
}
