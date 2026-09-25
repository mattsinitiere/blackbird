import { analyzeGame } from "./index.js";
import { round, pct, avg, sum } from "./common.js";
import { X01_TARGETS } from "../constants.js";
import { HALVEIT_TARGETS, halveItTargetLabel } from "./halveit.js";
import { clockLabel } from "./clock.js";

/**
 * Career aggregates per game type for one player, built from per-game
 * analyzes so legacy rows and v2 rows combine honestly: every rate has
 * the coverage it was computed over. Pure.
 */
const COMPETITIVE = ["x01", "cricket", "baseball", "aroundTheClock", "killer", "shanghai", "halveit", "gotcha", "tictactoe"];
const DRILLS = ["bobs27", "checkoutDrill", "scoringDrill"];

function coverage(list) {
  return {
    games: list.length,
    withVisits: list.filter((g) => g.a.quality.hasVisits).length,
    withMisses: list.filter((g) => g.a.quality.hasMisses).length,
    withTimes: list.filter((g) => g.a.quality.hasTimes).length,
    exactLanding: list.filter((g) => g.a.quality.exactLanding && g.a.quality.hasVisits).length,
  };
}

const m = (g, k) => g.a.metrics?.[k];
const series = (list, pick, dec = 1) => list.map((g, i) => ({ x: i + 1, y: pick(g), date: g.row.completedAt })).filter((p) => p.y != null && Number.isFinite(p.y)).map((p) => ({ ...p, y: round(p.y, dec) }));

function x01Career(list) {
  const darts = sum(list, (g) => g.a.totals.dartsThrown);
  const points = sum(list, (g) => g.a.totals.points);
  const withV = list.filter((g) => g.a.quality.hasVisits);
  const chances = sum(withV, (g) => m(g, "checkoutChances"));
  const hits = sum(withV, (g) => m(g, "checkoutHits"));
  const f9 = list.filter((g) => m(g, "first9Avg") != null);
  const wonLegs = list.flatMap((g) => g.a.rounds.filter((l) => l.won && l.darts > 0).map((l) => l.darts));
  const buckets = { "0-39": 0, "40-59": 0, "60-99": 0, "100+": 0 };
  for (const g of withV) for (const k in buckets) buckets[k] += m(g, "visitBuckets")?.[k] || 0;
  const chancesByRange = { "2-40": 0, "41-70": 0, "71-100": 0, "101-170": 0 };
  const hitsByRange = { "2-40": 0, "41-70": 0, "71-100": 0, "101-170": 0 };
  for (const g of withV) for (const k in chancesByRange) { chancesByRange[k] += m(g, "chancesByRange")?.[k] || 0; hitsByRange[k] += m(g, "hitsByRange")?.[k] || 0; }
  const allDarts = withV.flatMap((g) => g.a.darts);
  const pos = [0, 1, 2].map((p) => { const at = allDarts.filter((d) => d.pos === p); return avg(sum(at, (d) => d.value), at.length); });
  return {
    threeDartAvg: darts ? round((points / darts) * 3, 1) : null,
    first9Avg: avg(sum(f9, (g) => m(g, "first9Avg")), f9.length),
    checkoutPct: pct(hits, chances),
    checkoutChances: chances,
    checkoutsHit: hits,
    checkoutByRange: Object.fromEntries(Object.keys(chancesByRange).map((k) => [k, { chances: chancesByRange[k], hits: hitsByRange[k], pct: pct(hitsByRange[k], chancesByRange[k]) }])),
    highestCheckout: Math.max(0, ...list.map((g) => (g.won ? m(g, "checkout") || 0 : 0))),
    highestTurn: Math.max(0, ...list.map((g) => m(g, "highestTurn") || 0)),
    one80s: sum(list, (g) => m(g, "one80s") ?? (g.row.stats?.highestTurn === 180 ? 1 : 0)),
    tons: sum(withV, (g) => m(g, "tons")),
    ton40s: sum(withV, (g) => m(g, "ton40s")),
    tonsPerGame: avg(sum(withV, (g) => m(g, "tons")), withV.length, 2),
    bustsPerGame: avg(sum(withV, (g) => m(g, "busts")), withV.length, 2),
    bestLeg: wonLegs.length ? Math.min(...wonLegs) : null,
    avgDartsPerWonLeg: avg(sum(wonLegs), wonLegs.length),
    twentyBedPct: allDarts.length ? pct(allDarts.filter((d) => d.n === 20 && d.mult > 0).length, allDarts.length) : null,
    trebleTwentyPct: allDarts.length ? pct(allDarts.filter((d) => d.n === 20 && d.mult === 3).length, allDarts.length) : null,
    missPct: allDarts.length ? pct(allDarts.filter((d) => d.n === 0 || d.mult === 0).length, allDarts.length) : null,
    byPosition: pos,
    visitBuckets: withV.length ? buckets : null,
    bestGameAvg: Math.max(0, ...list.map((g) => m(g, "threeDartAvg") || 0)) || null,
    series: {
      avg: series(list, (g) => m(g, "threeDartAvg")),
      first9: series(list, (g) => m(g, "first9Avg")),
      checkoutPct: series(withV.filter((g) => m(g, "checkoutChances") > 0), (g) => m(g, "checkoutPct")),
      tons: series(withV, (g) => m(g, "tons"), 0),
    },
  };
}

function cricketCareer(list) {
  const marks = sum(list, (g) => g.a.totals.marks);
  const rounds = sum(list, (g) => g.a.totals.rounds);
  const logged = list.filter((g) => g.a.quality.hasMisses);
  const perNumber = {};
  for (const k of X01_TARGETS) perNumber[k] = { darts: 0, marks: 0, hits: 0, trebles: 0 };
  let loggedDarts = 0;
  let misses = 0;
  let dead = 0;
  const firstClosed = {};
  for (const g of logged) {
    loggedDarts += g.a.totals.dartsThrown;
    misses += g.a.perDart.misses || 0;
    dead += m(g, "deadDarts") || 0;
    const pn = m(g, "perNumber") || {};
    for (const k of X01_TARGETS) { for (const f of ["darts", "marks", "hits", "trebles"]) perNumber[k][f] += pn[k]?.[f] || 0; }
    const order = m(g, "closingOrder") || [];
    if (order[0]) firstClosed[order[0]] = (firstClosed[order[0]] || 0) + 1;
  }
  for (const k of X01_TARGETS) perNumber[k].share = pct(perNumber[k].darts, loggedDarts);
  const fav = Object.entries(firstClosed).sort((a, b) => b[1] - a[1])[0];
  return {
    mpr: rounds ? round(marks / rounds, 2) : null,
    bestMpr: Math.max(0, ...list.map((g) => m(g, "mpr") || 0)) || null,
    pointsPerRound: rounds ? round(sum(list, (g) => g.a.totals.points) / rounds, 1) : null,
    marksPerRoundBest: Math.max(0, ...list.map((g) => m(g, "bestRound") || 0)) || null,
    missPct: loggedDarts ? pct(misses, loggedDarts) : null,
    deadDartPct: loggedDarts ? pct(dead, loggedDarts) : null,
    trebleRate: loggedDarts ? pct(sum(X01_TARGETS, (k) => perNumber[k].trebles), loggedDarts - misses) : null,
    perNumber: loggedDarts ? perNumber : null,
    favouriteOpener: fav ? { number: fav[0], games: fav[1] } : null,
    avgRoundsPerGame: avg(rounds, list.length),
    series: { mpr: series(list, (g) => m(g, "mpr"), 2), pointsPerRound: series(list, (g) => m(g, "pointsPerRound")) },
  };
}

function baseballCareer(list) {
  const runs = sum(list, (g) => g.a.totals.runs);
  const innings = sum(list, (g) => g.a.totals.innings);
  const hits = { S: 0, D: 0, T: 0, miss: 0 };
  let darts = 0;
  const byInning = Array(9).fill(0);
  const byInningN = Array(9).fill(0);
  for (const g of list) {
    const hb = m(g, "hitsBy");
    if (hb) { for (const k in hits) hits[k] += hb[k] || 0; darts += g.a.totals.dartsThrown; }
    g.a.rounds.slice(0, 9).forEach((r, i) => { byInning[i] += r.runs; byInningN[i]++; });
  }
  return {
    avgRuns: avg(runs, list.length),
    avgRunsPerInning: avg(runs, innings, 2),
    bestGame: Math.max(0, ...list.map((g) => g.a.totals.runs)) || null,
    biggestInning: Math.max(0, ...list.map((g) => m(g, "biggestInning") || 0)) || null,
    hitRate: darts ? pct(darts - hits.miss, darts) : null,
    trebleRate: darts ? pct(hits.T, darts) : null,
    hitsBy: darts ? hits : null,
    runsByInning: byInning.map((r, i) => (byInningN[i] ? round(r / byInningN[i], 2) : null)),
    scorelessInningPct: innings ? pct(sum(list, (g) => m(g, "scorelessInnings")), innings) : null,
    series: { runs: series(list, (g) => g.a.totals.runs, 0) },
  };
}

function clockCareer(list) {
  const finished = list.filter((g) => m(g, "finished") && m(g, "dartsToFinish"));
  const perTarget = Array(21).fill(0);
  let withPT = 0;
  for (const g of list) { const dpt = m(g, "dartsPerTarget"); if (dpt) { withPT++; dpt.forEach((v, i) => (perTarget[i] += v)); } }
  const hardest = withPT ? perTarget.indexOf(Math.max(...perTarget)) + 1 : null;
  return {
    avgDartsToFinish: avg(sum(finished, (g) => m(g, "dartsToFinish")), finished.length),
    bestDartsToFinish: finished.length ? Math.min(...finished.map((g) => m(g, "dartsToFinish"))) : null,
    hitRate: pct(sum(list, (g) => g.a.totals.targetsHit), sum(list, (g) => g.a.totals.dartsThrown)),
    hardestTarget: hardest ? { target: clockLabel(hardest), avgDarts: round(perTarget[hardest - 1] / withPT, 1) } : null,
    dartsPerTarget: withPT ? perTarget.map((v) => round(v / withPT, 1)) : null,
    series: { darts: series(finished, (g) => m(g, "dartsToFinish"), 0) },
  };
}

function killerCareer(list) {
  const ev = list.filter((g) => m(g, "kills") != null);
  const dk = list.filter((g) => m(g, "dartsToBecomeKiller") != null);
  return {
    kills: sum(ev, (g) => m(g, "kills")),
    livesTaken: sum(ev, (g) => m(g, "livesTaken")),
    livesLost: sum(ev, (g) => m(g, "livesLost")),
    selfHits: sum(ev, (g) => m(g, "selfHits")),
    avgDartsToKiller: avg(sum(dk, (g) => m(g, "dartsToBecomeKiller")), dk.length),
    doubleHitRate: pct(sum(list, (g) => g.a.darts.filter((d) => d.mult === 2 && d.n > 0).length), sum(list, (g) => g.a.darts.length)),
    series: {},
  };
}

function shanghaiCareer(list) {
  return {
    avgScore: avg(sum(list, (g) => m(g, "totalScore")), list.length),
    bestGame: Math.max(0, ...list.map((g) => m(g, "totalScore") || 0)) || null,
    bestRound: Math.max(0, ...list.map((g) => m(g, "bestRound") || 0)) || null,
    shanghais: list.filter((g) => m(g, "shanghai")).length,
    hitRate: pct(sum(list, (g) => (m(g, "hitRate") != null ? (m(g, "hitRate") / 100) * g.a.totals.dartsThrown : 0)), sum(list.filter((g) => m(g, "hitRate") != null), (g) => g.a.totals.dartsThrown)),
    series: { score: series(list, (g) => m(g, "totalScore"), 0) },
  };
}

function halveitCareer(list) {
  const perTarget = {};
  for (const t of HALVEIT_TARGETS) perTarget[halveItTargetLabel(t)] = { darts: 0, hits: 0, halved: 0, rounds: 0 };
  for (const g of list) {
    const pt = m(g, "perTarget");
    if (!pt) continue;
    for (const k in pt) { if (!perTarget[k]) continue; perTarget[k].darts += pt[k].darts; perTarget[k].hits += pt[k].hits; perTarget[k].rounds++; if (pt[k].halved) perTarget[k].halved++; }
  }
  for (const k in perTarget) perTarget[k].hitRate = pct(perTarget[k].hits, perTarget[k].darts);
  const rated = Object.entries(perTarget).filter(([, v]) => v.darts > 0);
  const weakest = rated.sort((a, b) => (a[1].hitRate ?? 0) - (b[1].hitRate ?? 0))[0];
  return {
    avgScore: avg(sum(list, (g) => m(g, "finalScore")), list.length),
    bestScore: Math.max(0, ...list.map((g) => m(g, "finalScore") || 0)) || null,
    halvesPerGame: avg(sum(list, (g) => m(g, "halves")), list.length, 2),
    targetHitPct: pct(sum(list, (g) => (m(g, "targetHitPct") != null ? (m(g, "targetHitPct") / 100) * g.a.totals.dartsThrown : 0)), sum(list.filter((g) => m(g, "targetHitPct") != null), (g) => g.a.totals.dartsThrown)),
    perTarget: rated.length ? perTarget : null,
    weakestTarget: weakest ? { target: weakest[0], hitRate: weakest[1].hitRate } : null,
    series: { score: series(list, (g) => m(g, "finalScore"), 0) },
  };
}

function gotchaCareer(list) {
  const withV = list.filter((g) => g.a.quality.hasVisits);
  const wins = list.filter((g) => g.won && m(g, "dartsToTarget"));
  return {
    bustRate: pct(sum(withV, (g) => m(g, "busts")), sum(withV, (g) => g.a.totals.visits)),
    resetsDealt: sum(list, (g) => m(g, "resetsDealt")),
    resetsReceived: sum(list, (g) => m(g, "resetsReceived")),
    avgDartsToTarget: avg(sum(wins, (g) => m(g, "dartsToTarget")), wins.length),
    bestDartsToTarget: wins.length ? Math.min(...wins.map((g) => m(g, "dartsToTarget"))) : null,
    series: { darts: series(wins, (g) => m(g, "dartsToTarget"), 0) },
  };
}

function tictactoeCareer(list) {
  const withV = list.filter((g) => g.a.quality.hasVisits);
  return {
    claimed: sum(withV, (g) => m(g, "claimed")),
    cancelled: sum(withV, (g) => m(g, "cancelled")),
    dartsPerClaim: withV.length ? avg(sum(withV, (g) => g.a.totals.dartsThrown), sum(withV, (g) => m(g, "claimed")), 2) : null,
    gridHitRate: pct(sum(withV, (g) => (m(g, "gridHitRate") / 100) * g.a.totals.dartsThrown), sum(withV, (g) => g.a.totals.dartsThrown)),
    series: {},
  };
}

function drillCareer(gameType, list) {
  if (gameType === "bobs27") {
    return {
      bestScore: Math.max(0, ...list.map((g) => m(g, "finalScore") || 0)) || null,
      avgScore: avg(sum(list, (g) => m(g, "finalScore")), list.length),
      doubleHitRate: pct(sum(list, (g) => m(g, "doublesHit")), sum(list, (g) => g.a.totals.dartsThrown)),
      cleanRuns: list.filter((g) => !m(g, "busted") && (m(g, "roundsCompleted") || 0) >= 21).length,
      bustRate: pct(list.filter((g) => m(g, "busted")).length, list.length),
      hitsByDouble: (() => { const acc = Array(21).fill(0); const n = Array(21).fill(0); for (const g of list) (m(g, "hitsByDouble") || []).forEach((h, i) => { acc[i] += h; n[i]++; }); return acc.map((h, i) => (n[i] ? round(h / n[i], 2) : null)); })(),
      series: { score: series(list, (g) => m(g, "finalScore"), 0) },
    };
  }
  if (gameType === "checkoutDrill") {
    const byRange = { "41-70": { finishes: 0, hits: 0 }, "71-100": { finishes: 0, hits: 0 }, "101-170": { finishes: 0, hits: 0 } };
    for (const g of list) { const br = m(g, "byRange"); if (br) for (const k in byRange) { byRange[k].finishes += br[k]?.finishes || 0; byRange[k].hits += br[k]?.hits || 0; } }
    for (const k in byRange) byRange[k].pct = pct(byRange[k].hits, byRange[k].finishes);
    return {
      hitRate: pct(sum(list, (g) => m(g, "hit")), sum(list, (g) => m(g, "finishes"))),
      dartsPerHit: avg(sum(list, (g) => (m(g, "dartsPerHit") || 0) * (m(g, "hit") || 0)), sum(list, (g) => m(g, "hit"))),
      highestCheckout: Math.max(0, ...list.map((g) => m(g, "highestCheckout") || 0)) || null,
      byRange,
      doubleHitRate: pct(sum(list, (g) => (m(g, "doubleHitRate") != null ? (m(g, "doubleHitRate") / 100) * g.a.totals.dartsThrown : 0)), sum(list.filter((g) => m(g, "doubleHitRate") != null), (g) => g.a.totals.dartsThrown)),
      series: { hitRate: series(list, (g) => m(g, "hitRate")) },
    };
  }
  const byTarget = {};
  for (const g of list) { const t = m(g, "target"); if (!byTarget[t]) byTarget[t] = { sessions: 0, best: 0, total: 0, visits: 0 }; byTarget[t].sessions++; byTarget[t].best = Math.max(byTarget[t].best, m(g, "avgPerVisit") || 0); byTarget[t].total += m(g, "total") || 0; byTarget[t].visits += m(g, "turns") || 0; }
  for (const t in byTarget) byTarget[t].avgPerVisit = avg(byTarget[t].total, byTarget[t].visits);
  return {
    bestAvgPerVisit: Math.max(0, ...list.map((g) => m(g, "avgPerVisit") || 0)) || null,
    hitRate: pct(sum(list, (g) => (m(g, "hitRate") / 100) * g.a.totals.dartsThrown), sum(list, (g) => g.a.totals.dartsThrown)),
    trebleRate: pct(sum(list, (g) => m(g, "trebles")), sum(list, (g) => g.a.totals.dartsThrown)),
    byTarget,
    series: { avgPerVisit: series(list, (g) => m(g, "avgPerVisit")) },
  };
}

const BUILDERS = { x01: x01Career, cricket: cricketCareer, baseball: baseballCareer, aroundTheClock: clockCareer, killer: killerCareer, shanghai: shanghaiCareer, halveit: halveitCareer, gotcha: gotchaCareer, tictactoe: tictactoeCareer };

export function computeCareer({ results, practice }, me) {
  const out = {};
  const comp = (results || []).filter((r) => r.username === me && r.result !== "practice").sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const prac = (practice || []).filter((r) => r.username === me).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  for (const gt of COMPETITIVE) {
    const list = comp.filter((r) => r.gameType === gt).map((row) => ({ row, won: row.winner === me, a: analyzeGame(row) }));
    if (!list.length) continue;
    out[gt] = { games: list.length, wins: list.filter((g) => g.won).length, coverage: coverage(list), ...BUILDERS[gt](list) };
  }
  for (const gt of DRILLS) {
    const list = prac.filter((r) => r.gameType === gt).map((row) => ({ row, won: row.winner === me, a: analyzeGame(row) }));
    if (!list.length) continue;
    out[gt] = { sessions: list.length, coverage: coverage(list), ...drillCareer(gt, list) };
  }
  return out;
}
