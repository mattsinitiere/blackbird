import { dartValue } from "../darts.js";
import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, avg, sum } from "./common.js";

/**
 * Gotcha analyzer. Legacy rows replay the scoring (3-dart visits, bust
 * above the target, win on it) but not when opponents reset the score, so
 * the trajectory is approximate whenever resets were received.
 */
export function analyzeGotcha(pp, config, { username, winner } = {}) {
  const target = config?.targetScore || 301;
  const stored = storedVisits(pp);
  const legacy = !stored;
  const notes = [];
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && pp.darts.length) {
    let score = 0;
    let visit = [];
    let vs = 0;
    const push = (k) => {
      const s = visit.reduce((a, d) => a + dartValue(d), 0);
      if (k !== "bust") score = k === "win" ? target : score + s;
      visits.push({ i: visits.length, r: visits.length, s0: vs, darts: visit, out: { k, s: k === "bust" ? 0 : s, sc: score, reset: [] } });
      visit = [];
      vs = score;
    };
    for (const d of pp.darts) {
      visit.push({ n: d.n, mult: d.mult });
      const ns = vs + visit.reduce((a, x) => a + dartValue(x), 0);
      if (ns > target) push("bust");
      else if (ns === target) push("win");
      else if (visit.length === 3) push("normal");
    }
    if (visit.length) push("normal");
    if (pp.resetsReceived > 0) notes.push("trajectory approximate: when opponents reset the score was not recorded before stats v2");
    else notes.push("visits rebuilt from the dart log");
  }
  const events = Array.isArray(pp?.events) ? pp.events : [];
  const darts = flattenVisits(visits);
  const busts = visits.filter((v) => v.out?.k === "bust").length;
  const scoring = visits.filter((v) => v.out?.k !== "bust");
  const metrics = {
    finalScore: pp?.finalScore ?? null,
    target,
    busts: visits.length ? busts : null,
    bustRate: visits.length ? pct(busts, visits.length) : null,
    resetsDealt: pp?.resetsDealt ?? null,
    resetsReceived: pp?.resetsReceived ?? null,
    resets: events.length ? events.filter((e) => e.t === "reset" && e.by === username).map((e) => ({ on: e.on, turn: e.turn, from: e.from })) : null,
    resetBy: events.length ? events.filter((e) => e.t === "reset" && e.on === username).map((e) => ({ by: e.by, turn: e.turn, from: e.from })) : null,
    avgPerVisit: avg(sum(scoring, (v) => v.out?.s || 0), scoring.length),
    bestVisit: scoring.length ? Math.max(...scoring.map((v) => v.out?.s || 0)) : null,
    dartsToTarget: winner === username ? darts.length || pp?.dartsThrown || null : null,
    trajectory: visits.map((v) => v.out?.sc ?? null),
  };
  const rounds = visits.map((v) => ({ r: v.r, label: `Visit ${v.i + 1}`, before: v.s0, scored: v.out?.s ?? 0, after: v.out?.sc ?? null, bust: v.out?.k === "bust", reset: v.out?.reset || [] }));
  return baseAnalysis({
    gameType: "gotcha",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: true, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, visits: visits.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: true }),
    metrics,
    seriesOut: { score: metrics.trajectory.map((y, i) => ({ x: i + 1, y })) },
  });
}
