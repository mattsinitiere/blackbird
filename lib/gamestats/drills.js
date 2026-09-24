import { bobsTarget, bobsRoundScore, BOBS27_START, BOBS27_ROUNDS, applyCheckoutDart, scoringDartValue } from "../drills.js";
import { checkoutRange } from "../x01log.js";
import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, avg, round, chunk, sum, isMiss } from "./common.js";

/** Bob's 27: three darts per round at each double in turn; exact for legacy rows. */
export function analyzeBobs27(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && pp.darts.length) {
    let score = BOBS27_START;
    visits = chunk(pp.darts, 3).map((darts, i) => {
      const { hits, delta } = bobsRoundScore(i + 1, darts);
      const s0 = score;
      score = Math.max(0, score + delta);
      return { i, r: i, s0, darts: darts.map((d) => ({ n: d.n, mult: d.mult })), out: { hits, delta, sc: score } };
    });
  }
  const darts = flattenVisits(visits);
  const rounds = visits.map((v) => ({ r: v.r, label: bobsTarget(v.r + 1).label, hits: v.out?.hits ?? 0, delta: v.out?.delta ?? 0, after: v.out?.sc ?? null }));
  const bustRound = rounds.find((r) => r.after === 0);
  const hitsByDouble = rounds.map((r) => r.hits);
  const metrics = {
    finalScore: pp?.finalScore ?? (rounds.length ? rounds[rounds.length - 1].after : null),
    doublesHit: pp?.doublesHit ?? sum(hitsByDouble),
    roundsCompleted: pp?.roundsCompleted ?? rounds.length,
    busted: !!pp?.busted,
    bustRound: bustRound ? bustRound.r + 1 : null,
    doubleHitRate: darts.length ? pct(sum(hitsByDouble), darts.length) : null,
    bestRound: rounds.length ? Math.max(...hitsByDouble) : null,
    missedRounds: rounds.filter((r) => r.hits === 0).length,
    hitsByDouble,
    peakScore: rounds.length ? Math.max(BOBS27_START, ...rounds.map((r) => r.after || 0)) : null,
  };
  return baseAnalysis({
    gameType: "bobs27",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: false, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy && visits.length ? ["rounds rebuilt from the dart log (3 darts each)"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, rounds: rounds.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: false }),
    metrics,
    seriesOut: { score: rounds.map((r, i) => ({ x: i + 1, y: r.after, label: r.label })), hits: rounds.map((r, i) => ({ x: i + 1, y: r.hits, label: r.label })) },
  });
}

/** Checkout drill: finishes from `results`, visits stored (v2) or replayed per finish. */
export function analyzeCheckoutDrill(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  const results = Array.isArray(pp?.results) ? pp.results : [];
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && results.length) {
    let offset = 0;
    results.forEach((res, fi) => {
      const mine = pp.darts.slice(offset, offset + res.darts);
      offset += res.darts;
      let rem = res.target;
      let visit = [];
      let vs = rem;
      const push = (k) => {
        visits.push({ i: visits.length, r: fi, s0: vs, darts: visit, out: { k, rem: k === "bust" ? vs : rem } });
        if (k === "bust") rem = vs;
        visit = [];
        vs = rem;
      };
      for (const d of mine) {
        visit.push({ n: d.n, mult: d.mult });
        const r = applyCheckoutDart(rem, d);
        rem = r.rem;
        if (r.status === "hit") {
          push("hit");
          break;
        }
        if (r.status === "bust") {
          push("bust");
          continue;
        }
        if (visit.length === 3) push("open");
      }
      if (visit.length) push(res.hit ? "hit" : "miss");
      else if (!res.hit && visits.length && visits[visits.length - 1].r === fi) visits[visits.length - 1].out.k = "miss";
    });
  }
  const darts = flattenVisits(visits);
  const byRange = {};
  for (const k of ["41-70", "71-100", "101-170"]) byRange[k] = { finishes: 0, hits: 0, pct: null };
  for (const r of results) {
    const k = r.target <= 70 ? "41-70" : r.target <= 100 ? "71-100" : "101-170";
    byRange[k].finishes++;
    if (r.hit) byRange[k].hits++;
  }
  for (const k in byRange) byRange[k].pct = pct(byRange[k].hits, byRange[k].finishes);
  const hits = results.filter((r) => r.hit);
  const rounds = results.map((r, i) => ({ r: i, label: String(r.target), target: r.target, darts: r.darts, hit: !!r.hit, visits: visits.filter((v) => v.r === i).length }));
  const metrics = {
    finishes: pp?.finishes ?? results.length,
    hit: pp?.hit ?? hits.length,
    hitRate: pct(hits.length, results.length),
    dartsPerHit: pp?.dartsPerHit ?? avg(sum(hits, (r) => r.darts), hits.length),
    highestCheckout: pp?.highestCheckout ?? (hits.length ? Math.max(...hits.map((r) => r.target)) : 0),
    byRange: results.length ? byRange : null,
    oneVisitFinishes: hits.filter((r) => r.darts <= 3).length,
    busts: visits.length ? visits.filter((v) => v.out?.k === "bust").length : null,
    doubleHitRate: darts.length ? pct(darts.filter((d) => !isMiss(d) && d.mult === 2).length, darts.length) : null,
  };
  return baseAnalysis({
    gameType: "checkoutDrill",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: true, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy && visits.length ? ["visits rebuilt per finish from the dart log"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, finishes: results.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: true }),
    metrics,
    seriesOut: { dartsPerFinish: rounds.map((r, i) => ({ x: i + 1, y: r.darts, label: r.label })) },
  });
}

/** Scoring drill: N visits at one number; legacy `visits` is an array of numbers. */
export function analyzeScoringDrill(pp, config, { username, winner } = {}) {
  const target = config?.target || 20;
  const stored = storedVisits(pp);
  const legacy = !stored;
  const legacyScores = Array.isArray(pp?.visits) && pp.visits.length && typeof pp.visits[0] === "number" ? pp.visits : null;
  let visits = stored || [];
  if (!visits.length && Array.isArray(pp?.darts) && pp.darts.length) {
    let total = 0;
    visits = chunk(pp.darts, 3).map((darts, i) => {
      const s = darts.reduce((a, d) => a + scoringDartValue(target, d), 0);
      const v = { i, r: i, s0: total, darts: darts.map((d) => ({ n: d.n, mult: d.mult })), out: { s } };
      total += s;
      return v;
    });
  }
  const visitScores = Array.isArray(pp?.visitScores) ? pp.visitScores : legacyScores || visits.map((v) => v.out?.s || 0);
  const darts = flattenVisits(visits);
  const onTarget = darts.filter((d) => d.n === target).length;
  const trebles = darts.filter((d) => d.n === target && d.mult === 3).length;
  const total = pp?.total ?? sum(visitScores);
  const metrics = {
    target,
    total,
    turns: pp?.turns ?? visitScores.length,
    avgPerVisit: avg(total, visitScores.length),
    bestVisit: pp?.bestVisit ?? (visitScores.length ? Math.max(...visitScores) : null),
    worstVisit: visitScores.length ? Math.min(...visitScores) : null,
    hitRate: darts.length ? pct(onTarget, darts.length) : pp?.hitRate ?? null,
    trebleRate: darts.length ? pct(trebles, darts.length) : null,
    trebles: pp?.trebles ?? trebles,
    visitScores,
  };
  const rounds = visitScores.map((s, i) => ({ r: i, label: `V${i + 1}`, score: s }));
  return baseAnalysis({
    gameType: "scoringDrill",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: false, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy && visits.length ? ["visits rebuilt from the dart log (3 darts each)"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, visits: visitScores.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: false }),
    metrics,
    seriesOut: { visitScores: visitScores.map((y, i) => ({ x: i + 1, y })) },
  });
}
