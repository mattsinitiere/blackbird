import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, round, chunk, isMiss } from "./common.js";

export const SHANGHAI_TARGETS = { beginner: [1, 2, 3, 4, 5, 6, 7], advanced: [15, 16, 17, 18, 19, 20, 25] };

export function shanghaiTargets(config) {
  return (config?.mode === "advanced" ? SHANGHAI_TARGETS.advanced : SHANGHAI_TARGETS.beginner);
}

function isShanghaiVisit(darts, target) {
  const on = (darts || []).filter((d) => d.n === target);
  return on.some((d) => d.mult === 1) && on.some((d) => d.mult === 2) && on.some((d) => d.mult === 3);
}

/** Shanghai analyzer. Legacy rows replay exactly: three darts per round at a known target. */
export function analyzeShanghai(pp, config, { username, winner } = {}) {
  const targets = shanghaiTargets(config);
  const stored = storedVisits(pp);
  const legacy = !stored;
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && pp.darts.length) {
    let total = 0;
    visits = chunk(pp.darts, 3).map((darts, i) => {
      const target = targets[Math.min(i, targets.length - 1)];
      const s = darts.reduce((a, d) => a + (d.n === target ? d.n * d.mult : 0), 0);
      const v = { i, r: i, s0: total, darts: darts.map((d) => ({ n: d.n, mult: d.mult })), out: { s, sh: isShanghaiVisit(darts, target) } };
      total += s;
      return v;
    });
  }
  const roundScores = Array.isArray(pp?.roundScores) && pp.roundScores.length ? pp.roundScores : visits.map((v) => v.out?.s || 0);
  const darts = flattenVisits(visits);
  const onTarget = darts.filter((d) => d.n === targets[Math.min(d.round, targets.length - 1)]).length;
  const ringMix = { S: 0, D: 0, T: 0, miss: 0 };
  for (const d of darts) ringMix[isMiss(d) ? "miss" : d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"]++;
  const best = roundScores.length ? Math.max(...roundScores) : null;
  const total = pp?.totalScore ?? roundScores.reduce((a, b) => a + b, 0);
  const rounds = roundScores.map((s, i) => ({ r: i, label: targets[i] === 25 ? "Bull" : String(targets[i] ?? i + 1), score: s, shanghai: visits[i]?.out?.sh ?? false }));
  const metrics = {
    totalScore: total,
    roundScores,
    bestRound: best,
    bestRoundAt: best != null ? roundScores.indexOf(best) + 1 : null,
    shanghai: !!pp?.shanghai,
    hitRate: darts.length ? pct(onTarget, darts.length) : null,
    pointsPerDart: darts.length ? round(total / darts.length, 2) : null,
    ringMix: darts.length ? ringMix : null,
    missPct: darts.length ? pct(ringMix.miss, darts.length) : null,
  };
  return baseAnalysis({
    gameType: "shanghai",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: true, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy && visits.length ? ["rounds rebuilt from the dart log (3 darts each)"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, rounds: roundScores.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: true }),
    metrics,
    seriesOut: { roundScores: roundScores.map((y, i) => ({ x: i + 1, y, label: rounds[i]?.label })) },
  });
}
