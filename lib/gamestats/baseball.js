import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, avg, round, sum, chunk, isMiss } from "./common.js";

export const BASEBALL_INNINGS = 9;
export const inningTarget = (i) => (i % 20) + 1;

/**
 * Baseball analyzer. Legacy rows are exactly recoverable: every inning is
 * three darts at a known number, so visits are rebuilt from the flat log.
 * Landings are synthetic (Single/Double/Triple of the target, or Miss).
 */
export function analyzeBaseball(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && pp.darts.length) {
    let total = 0;
    visits = chunk(pp.darts, 3).map((darts, i) => {
      const tgt = inningTarget(i);
      const runs = darts.reduce((a, d) => a + (d.n === tgt ? d.mult : 0), 0);
      const v = { i, r: i, s0: total, darts: darts.map((d) => ({ n: d.n, mult: d.mult })), out: { runs } };
      total += runs;
      return v;
    });
  }
  const innings = Array.isArray(pp?.innings) && pp.innings.length ? pp.innings : visits.map((v) => v.out?.runs || 0);
  const runs = pp?.runs ?? sum(innings);
  const darts = flattenVisits(visits);
  const hitsBy = { S: 0, D: 0, T: 0, miss: 0 };
  for (const d of darts) {
    if (isMiss(d)) hitsBy.miss++;
    else hitsBy[d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"]++;
  }
  const rounds = innings.map((r, i) => ({ r: i, label: i < BASEBALL_INNINGS ? `Inning ${i + 1}` : `Extra ${i - BASEBALL_INNINGS + 1}`, target: inningTarget(i), runs: r }));
  const best = innings.length ? Math.max(...innings) : null;
  const basics = perDartBasics(darts, { exactLanding: false });
  const metrics = {
    runs,
    innings: innings.length,
    extraInnings: Math.max(0, innings.length - BASEBALL_INNINGS),
    avgRunsPerInning: avg(runs, innings.length, 2),
    biggestInning: best,
    biggestInningAt: best != null ? innings.indexOf(best) + 1 : null,
    scorelessInnings: innings.filter((r) => r === 0).length,
    hitRate: darts.length ? pct(darts.length - hitsBy.miss, darts.length) : null,
    hitsBy: darts.length ? hitsBy : null,
    trebleRate: darts.length ? pct(hitsBy.T, darts.length) : null,
    runsPerDart: darts.length ? round(runs / darts.length, 2) : null,
  };
  return baseAnalysis({
    gameType: "baseball",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: visits.length > 0, exactLanding: false, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy && visits.length ? ["innings rebuilt from the dart log (3 darts each)"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, runs, innings: innings.length, durationMs: pp?.durationMs ?? null },
    perDart: basics,
    metrics,
    seriesOut: { runsPerInning: innings.map((y, i) => ({ x: i + 1, y, label: rounds[i]?.label })) },
  });
}
