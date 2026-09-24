import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, avg, chunk, sum, isMiss } from "./common.js";

/** Halve It rules shared by the play screen and the analyzer. */
export const HALVEIT_TARGETS = [20, 19, 18, "D", 17, 16, 15, "T", "B"];
export const HALVEIT_START = 40;

export const halveItTargetLabel = (t) => (t === "D" ? "Any Double" : t === "T" ? "Any Triple" : t === "B" ? "Bull" : String(t));

export function hitsTarget(dart, target) {
  if (!dart || dart.n === 0) return false;
  if (typeof target === "number") return dart.n === target;
  if (target === "D") return dart.mult === 2;
  if (target === "T") return dart.mult === 3;
  if (target === "B") return dart.n === 25;
  return false;
}

export function scoreDart(dart, target) {
  if (!hitsTarget(dart, target)) return 0;
  if (typeof target === "number") return dart.n * dart.mult;
  if (target === "D") return dart.n * 2;
  if (target === "T") return dart.n * 3;
  if (target === "B") return 25 * dart.mult;
  return 0;
}

/**
 * Halve It analyzer. Legacy rows are fully recoverable: nine rounds of
 * three darts at fixed targets, so each round's score and halving replay
 * exactly from the flat log.
 */
export function analyzeHalveIt(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && pp.darts.length) {
    let score = HALVEIT_START;
    visits = chunk(pp.darts, 3).map((darts, i) => {
      const target = HALVEIT_TARGETS[i] ?? HALVEIT_TARGETS[HALVEIT_TARGETS.length - 1];
      const s0 = score;
      const s = darts.reduce((a, d) => a + scoreDart(d, target), 0);
      const halved = s === 0;
      score = halved ? Math.floor(score / 2) : score + s;
      return { i, r: i, s0, darts: darts.map((d) => ({ n: d.n, mult: d.mult })), out: { s, halved, sc: score } };
    });
  }
  const roundScores = Array.isArray(pp?.roundScores) && pp.roundScores.length ? pp.roundScores : visits.map((v) => v.out?.s || 0);
  const halvedRounds = visits.length ? visits.map((v, i) => (v.out?.halved ? i : -1)).filter((i) => i >= 0) : null;
  const darts = flattenVisits(visits);
  const perTarget = visits.length ? {} : null;
  if (perTarget) {
    visits.forEach((v) => {
      const target = HALVEIT_TARGETS[v.r] ?? "?";
      const k = halveItTargetLabel(target);
      const hits = (v.darts || []).filter((d) => hitsTarget(d, target)).length;
      perTarget[k] = { darts: (v.darts || []).length, hits, hitRate: pct(hits, (v.darts || []).length), halved: !!v.out?.halved };
    });
  }
  const worst = visits.length ? visits.filter((v) => v.out?.halved).map((v) => v.s0 - Math.floor(v.s0 / 2)) : [];
  const rounds = roundScores.map((s, i) => ({ r: i, label: halveItTargetLabel(HALVEIT_TARGETS[i] ?? "?"), score: s, halved: halvedRounds ? halvedRounds.includes(i) : s === 0, after: visits[i]?.out?.sc ?? null }));
  const hitDarts = darts.filter((d, i) => hitsTarget(d, HALVEIT_TARGETS[d.round] ?? "?")).length;
  const metrics = {
    finalScore: pp?.finalScore ?? (visits.length ? visits[visits.length - 1].out?.sc : null),
    halves: pp?.halves ?? (halvedRounds ? halvedRounds.length : null),
    roundScores,
    halvedRounds,
    bestRound: roundScores.length ? Math.max(...roundScores) : null,
    bestRoundAt: roundScores.length ? roundScores.indexOf(Math.max(...roundScores)) + 1 : null,
    targetHitPct: darts.length ? pct(hitDarts, darts.length) : null,
    perTarget,
    trajectory: visits.map((v) => v.out?.sc ?? null),
    biggestHalving: worst.length ? Math.max(...worst) : null,
  };
  return baseAnalysis({
    gameType: "halveit",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: visits.length > 0, exactLanding: true, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy && visits.length ? ["rounds rebuilt from the dart log (3 darts each)"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, rounds: roundScores.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: true }),
    metrics,
    seriesOut: { roundScores: roundScores.map((y, i) => ({ x: i + 1, y, label: rounds[i]?.label })), score: metrics.trajectory.map((y, i) => ({ x: i + 1, y })) },
  });
}
