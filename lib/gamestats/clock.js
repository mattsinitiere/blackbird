import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, avg, round, chunk, isMiss } from "./common.js";

export const CLOCK_TARGETS = 21; // 1..20 then bull
export const clockNumber = (t) => (t === 21 ? 25 : t);
export const clockLabel = (t) => (t === 21 ? "Bull" : String(t));

/**
 * Around the Clock analyzer. Legacy rows replay exactly (3 darts per
 * visit, a hit on the current number advances it). Darts thrown after the
 * clock was finished (an older keypad quirk) are not counted.
 */
export function analyzeClock(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && pp.darts.length) {
    let target = 1;
    visits = chunk(pp.darts, 3).map((darts, i) => {
      const s0 = target;
      const kept = [];
      for (const d of darts) {
        if (target > CLOCK_TARGETS) break;
        kept.push({ n: d.n, mult: d.mult });
        if (d.n === clockNumber(target)) target++;
      }
      return { i, r: i, s0, darts: kept, out: { hit: target - s0, tgt: target } };
    }).filter((v) => v.darts.length);
  }
  // darts per target from the visits
  const dartsPerTarget = Array(CLOCK_TARGETS).fill(0);
  let finishedAt = null;
  let count = 0;
  for (const v of visits) {
    let t = v.s0;
    for (const d of v.darts || []) {
      if (t > CLOCK_TARGETS) break;
      dartsPerTarget[t - 1]++;
      count++;
      if (d.n === clockNumber(t)) {
        t++;
        if (t > CLOCK_TARGETS && finishedAt == null) finishedAt = count;
      }
    }
  }
  const darts = flattenVisits(visits);
  const targetsHit = pp?.targetsHit ?? (visits.length ? Math.min(CLOCK_TARGETS, visits[visits.length - 1].out?.tgt - 1) : 0);
  const dartsThrown = visits.length ? count : pp?.dartsThrown || 0;
  const hardest = visits.length ? dartsPerTarget.indexOf(Math.max(...dartsPerTarget)) + 1 : null;
  const ringMix = { S: 0, D: 0, T: 0, miss: 0 };
  for (const d of darts) ringMix[isMiss(d) ? "miss" : d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"]++;
  const metrics = {
    targetsHit,
    dartsToFinish: finishedAt,
    finished: targetsHit >= CLOCK_TARGETS,
    hitRate: dartsThrown ? pct(targetsHit, dartsThrown) : null,
    avgDartsPerTarget: targetsHit ? round(dartsThrown / targetsHit, 2) : null,
    dartsPerTarget: visits.length ? dartsPerTarget : null,
    hardestTarget: hardest ? { target: clockLabel(hardest), darts: dartsPerTarget[hardest - 1] } : null,
    ringMix: darts.length ? ringMix : null,
    missPct: darts.length ? pct(ringMix.miss, darts.length) : null,
  };
  const rounds = visits.map((v) => ({ r: v.r, label: `Visit ${v.i + 1}`, from: clockLabel(v.s0), to: v.out?.tgt > CLOCK_TARGETS ? "done" : clockLabel(v.out?.tgt ?? v.s0), hit: v.out?.hit ?? 0 }));
  return baseAnalysis({
    gameType: "aroundTheClock",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: true, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy && visits.length ? ["visits rebuilt from the dart log; darts after the finish are not counted"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown, targetsHit, visits: visits.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: true }),
    metrics,
    seriesOut: { dartsPerTarget: (metrics.dartsPerTarget || []).map((y, i) => ({ x: i + 1, y, label: clockLabel(i + 1) })), progress: visits.map((v, i) => ({ x: i + 1, y: Math.min(CLOCK_TARGETS, (v.out?.tgt ?? v.s0) - 1) })) },
  });
}
