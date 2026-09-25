import { X01_TARGETS } from "../constants.js";
import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, avg, round, sum, isMiss } from "./common.js";

const keyOf = (d) => (d.n === 25 ? "B" : String(d.n));
const onTarget = (d) => !isMiss(d) && X01_TARGETS.includes(keyOf(d));

/**
 * Cricket analyzer. v2 rows carry every dart (misses included) with the
 * marks credited per dart; legacy rows carry only the hits and per-round
 * marks, so per-number rates are unknown there.
 */
export function analyzeCricket(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  const notes = [];
  const visits = stored || [];
  const roundMarks = Array.isArray(pp?.roundMarks) ? pp.roundMarks : visits.map((v) => v.out?.marks || 0);
  const roundsPlayed = pp?.rounds ?? visits.length;
  const marks = pp?.marks ?? sum(roundMarks);
  const points = pp?.pointsScored || 0;

  const darts = flattenVisits(visits);
  let dartsThrown;
  let estimated = false;
  if (visits.length) dartsThrown = darts.length;
  else {
    dartsThrown = roundsPlayed * 3;
    estimated = true;
    notes.push("misses were not logged before stats v2: darts thrown is estimated as 3 per round");
  }

  // per number: darts landed, marks credited, triples; rounds to close; closing order
  let perNumber = null;
  let roundsToClose = null;
  let closingOrder = null;
  let dead = 0;
  if (visits.length) {
    perNumber = {};
    for (const k of X01_TARGETS) perNumber[k] = { darts: 0, marks: 0, hits: 0, trebles: 0 };
    const m = {};
    for (const k of X01_TARGETS) m[k] = 0;
    roundsToClose = {};
    closingOrder = [];
    for (const v of visits) {
      for (const d of v.darts || []) {
        if (!onTarget(d)) continue;
        const k = keyOf(d);
        perNumber[k].darts++;
        perNumber[k].hits += d.mult;
        perNumber[k].marks += d.x?.m ?? 0;
        if (d.mult === 3) perNumber[k].trebles++;
        const before = m[k];
        m[k] += d.mult;
        if (before < 3 && m[k] >= 3) {
          roundsToClose[k] = v.i + 1;
          closingOrder.push(k);
        }
      }
      dead += v.out?.dead || 0;
    }
  }
  const pointsPerRound = visits.length ? visits.map((v) => v.out?.pts || 0) : null;
  const basics = perDartBasics(darts, { exactLanding: visits.length > 0 });
  const onTargetDarts = darts.filter(onTarget).length;

  const rounds = roundMarks.map((mk, i) => ({ r: i, label: `R${i + 1}`, marks: mk, points: pointsPerRound ? pointsPerRound[i] : null, darts: visits[i]?.darts?.length ?? null }));

  const metrics = {
    mpr: roundsPlayed ? round(marks / roundsPlayed, 2) : pp?.mpr ?? null,
    marks,
    rounds: roundsPlayed,
    points,
    pointsPerRound: roundsPlayed ? round(points / roundsPlayed, 1) : null,
    marksPerRound: roundMarks,
    bestRound: roundMarks.length ? Math.max(...roundMarks) : null,
    hitRate: visits.length ? pct(onTargetDarts, darts.length) : null,
    missPct: visits.length ? basics.missPct : null,
    deadDarts: visits.length ? dead : null,
    deadDartPct: visits.length ? pct(dead, darts.length) : null,
    perNumber,
    roundsToClose,
    closingOrder,
    trebleRate: visits.length ? pct(darts.filter((d) => onTarget(d) && d.mult === 3).length, onTargetDarts) : null,
    secondsPerRound: pp?.durationMs && roundsPlayed ? round(pp.durationMs / 1000 / roundsPlayed, 1) : null,
  };

  return baseAnalysis({
    gameType: "cricket",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: visits.length > 0, exactLanding: visits.length > 0, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes }),
    visits,
    rounds,
    totals: { dartsThrown, dartsEstimated: estimated, marks, rounds: roundsPlayed, points, durationMs: pp?.durationMs ?? null },
    perDart: basics,
    metrics,
    seriesOut: {
      marksPerRound: roundMarks.map((y, i) => ({ x: i + 1, y })),
      pointsPerRound: pointsPerRound ? pointsPerRound.map((y, i) => ({ x: i + 1, y })) : [],
    },
  });
}
