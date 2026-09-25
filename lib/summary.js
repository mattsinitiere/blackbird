/**
 * Post-game summary: one normalized shape built from the match every play
 * screen hands to onFinish, so the phone's end screen and the TV render
 * the same thing. Pure — no React, no network.
 *
 * {
 *   gameType, title, winner, ranked, completedAt, durationMin, totalDarts,
 *   rows: [{ u, name, color, tag, tagIcon, isWinner, rank,
 *            primary: { label, value },          // the one big number
 *            stats:   [{ label, value }],        // small chips
 *            elo:     { before, after, delta } | null }],
 *   highlights: [{ label, value, player }]
 * }
 */

import { isRankedMatch } from "./practice.js";
import { analyzePerformance } from "./gamestats/index.js";
import { playerLabel } from "./bots.js";

const GAME_NAMES = {
  x01: "X01",
  cricket: "Cricket",
  baseball: "Baseball",
  aroundTheClock: "Around the Clock",
  killer: "Killer",
  shanghai: "Shanghai",
  halveit: "Halve It",
  gotcha: "Gotcha",
  tictactoe: "Tic-Tac-Toe",
  bobs27: "Bob's 27",
  checkoutDrill: "Checkout Drill",
  scoringDrill: "Scoring Drill",
};

/** Every playable game mode, in the order New Game lists them. */
export const GAME_MODES = Object.keys(GAME_NAMES);

export function gameName(gameType) {
  return GAME_NAMES[gameType] || gameType;
}

export function gameTitle(gameType, config = {}) {
  if (gameType === "x01") {
    const parts = [String(config.startScore || 501), config.doubleOut === false ? "straight out" : "double out"];
    if ((config.legs || 1) > 1) parts.push(`best of ${config.legs}`);
    return parts.join(" · ");
  }
  if (gameType === "cricket") {
    const v = config.variant;
    return `Cricket · ${v === "cutthroat" ? "Cutthroat" : v === "noscore" ? "No-score" : "Score"}`;
  }
  if (gameType === "shanghai") return `Shanghai · ${config.mode === "advanced" ? "Advanced" : "Beginner"}`;
  if (gameType === "gotcha") return `Gotcha · ${config.targetScore || 301}`;
  if (gameType === "killer") return `Killer · ${config.lives || 3} lives`;
  if (gameType === "checkoutDrill") return `Checkout Drill · ${config.count || 10} finishes`;
  if (gameType === "scoringDrill") return `Scoring Drill · ${config.target === 25 ? "Bull" : `${config.target || 20}s`} · ${config.turns || 10} visits`;
  return gameName(gameType);
}

const fmt1 = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);
const fmt2 = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);

function dartsThrown(pp) {
  if (typeof pp.dartsThrown === "number") return pp.dartsThrown;
  if (Array.isArray(pp.darts)) return pp.darts.length;
  return 0;
}

/**
 * Per-game presentation of one player's finish stats. `score` is the
 * number rows are ranked by (higher is better unless `lowerIsBetter`).
 */
export function describe(gameType, config, pp, isWinner) {
  const darts = dartsThrown(pp);
  const dartsStat = { label: "darts", value: darts };
  switch (gameType) {
    case "x01": {
      const avg = pp.dartsThrown ? (pp.pointsScored / pp.dartsThrown) * 3 : 0;
      const stats = [{ label: "high turn", value: pp.highestTurn || 0 }, dartsStat];
      if (isWinner && pp.checkout) stats.push({ label: "checkout", value: pp.checkout });
      const legs = (config && config.legs) || 1;
      if (legs > 1) {
        stats.unshift({ label: "3-dart avg", value: fmt1(avg) });
        return { primary: { label: "legs", value: pp.legsWon || 0 }, stats, score: (pp.legsWon || 0) * 1000 + avg };
      }
      return { primary: { label: "3-dart avg", value: fmt1(avg) }, stats, score: avg };
    }
    case "cricket": {
      const variant = (config && config.variant) || "standard";
      const mpr = pp.mpr != null ? pp.mpr : pp.rounds ? pp.marks / pp.rounds : 0;
      const stats = [{ label: "MPR", value: fmt2(mpr) }, { label: "marks", value: pp.marks || 0 }, { label: "rounds", value: pp.rounds || 0 }];
      if (variant === "noscore") return { primary: { label: "MPR", value: fmt2(mpr) }, stats, score: mpr };
      stats.unshift({ label: "points", value: pp.pointsScored || 0 });
      return {
        primary: { label: "points", value: pp.pointsScored || 0 },
        stats: stats.slice(1),
        score: pp.pointsScored || 0,
        lowerIsBetter: variant === "cutthroat",
      };
    }
    case "baseball":
      return { primary: { label: "runs", value: pp.runs || 0 }, stats: [dartsStat], score: pp.runs || 0 };
    case "aroundTheClock": {
      const hit = pp.targetsHit || 0;
      const rate = darts ? (hit / darts) * 100 : 0;
      return {
        primary: { label: "of 21", value: hit },
        stats: [{ label: "hit rate", value: `${Math.round(rate)}%` }, dartsStat],
        score: hit * 1000 - darts,
      };
    }
    case "killer": {
      const lives = pp.livesRemaining || 0;
      return {
        primary: { label: "lives", value: lives },
        stats: [{ label: "killer", value: pp.isKiller ? "yes" : "no" }, dartsStat],
        score: lives,
      };
    }
    case "shanghai": {
      const best = Array.isArray(pp.roundScores) && pp.roundScores.length ? Math.max(...pp.roundScores) : 0;
      const stats = [{ label: "best round", value: best }, dartsStat];
      if (pp.shanghai) stats.unshift({ label: "Shanghai!", value: "✓" });
      return { primary: { label: "points", value: pp.totalScore || 0 }, stats, score: pp.shanghai ? Infinity : pp.totalScore || 0 };
    }
    case "halveit":
      return {
        primary: { label: "points", value: pp.finalScore || 0 },
        stats: [{ label: "halved", value: `${pp.halves || 0}×` }, dartsStat],
        score: pp.finalScore || 0,
      };
    case "gotcha":
      return {
        primary: { label: "score", value: pp.finalScore || 0 },
        stats: [{ label: "resets dealt", value: pp.resetsDealt || 0 }, { label: "reset", value: `${pp.resetsReceived || 0}×` }, dartsStat],
        score: pp.finalScore || 0,
      };
    case "tictactoe":
      return { primary: { label: "squares", value: pp.squaresClaimed || 0 }, stats: [dartsStat], score: pp.squaresClaimed || 0 };
    case "bobs27": {
      const score = pp.finalScore || 0;
      const stats = [{ label: "doubles", value: pp.doublesHit || 0 }, { label: "rounds", value: pp.roundsCompleted || 0 }, dartsStat];
      if (pp.busted) stats.unshift({ label: "busted", value: "out" });
      return { primary: { label: "score", value: score }, stats, score: (pp.busted ? -1e6 : 0) + score };
    }
    case "checkoutDrill": {
      const hit = pp.hit || 0;
      const stats = [{ label: "darts / hit", value: pp.dartsPerHit ? fmt1(pp.dartsPerHit) : "—" }, dartsStat];
      if (pp.highestCheckout) stats.unshift({ label: "highest", value: pp.highestCheckout });
      return { primary: { label: `of ${pp.finishes || 0}`, value: hit }, stats, score: hit * 10000 - darts };
    }
    case "scoringDrill":
      return {
        primary: { label: "points", value: pp.total || 0 },
        stats: [{ label: "per visit", value: fmt1(pp.avgPerTurn) }, { label: "trebles", value: pp.trebles || 0 }, { label: "on target", value: `${pp.hitRate || 0}%` }],
        score: pp.total || 0,
      };
    default:
      return { primary: { label: "", value: "" }, stats: [dartsStat], score: 0 };
  }
}

/**
 * Finishing order for one game: { username: place }. The winner is 1st;
 * everyone else is ranked by the same per-game score the summary uses,
 * and losers whose scores tie get no place (null) rather than a guess:
 * in Killer, for instance, everyone knocked out ends on 0 lives. Captured
 * on each result row as `stats.place` so multiplayer standings survive.
 */
export function finishPlaces({ gameType, config = {}, players = [], winner, perPlayer = {} }) {
  const scored = players.map((u) => {
    const d = describe(gameType, config, perPlayer[u] || {}, u === winner);
    return { u, won: u === winner, score: d.score, lower: !!d.lowerIsBetter };
  });
  scored.sort((a, b) => {
    if (a.won !== b.won) return a.won ? -1 : 1;
    return a.lower ? a.score - b.score : b.score - a.score;
  });
  const out = {};
  scored.forEach((r, i) => {
    const tied = !r.won && scored.some((o, j) => j !== i && !o.won && o.score === r.score);
    out[r.u] = tied ? null : i + 1;
  });
  return out;
}

function highlightsFor(gameType, config, rows, perPlayer) {
  const out = [];
  // per-game analysis (stats v2 or replayed legacy rows) for the metrics
  // the raw per-player block never stored
  const analysis = {};
  for (const r of rows) analysis[r.u] = analyzePerformance(gameType, config, perPlayer[r.u] || {}, { username: r.u, winner: rows.find((x) => x.isWinner)?.u });
  const metric = (u, key) => (analysis[u] && analysis[u].metrics ? analysis[u].metrics[key] : null);
  const best = (label, pick, fmt = (v) => v) => {
    let top = null;
    for (const r of rows) {
      const v = pick(perPlayer[r.u] || {}, r);
      if (v == null || Number.isNaN(v) || v <= 0) continue;
      if (!top || v > top.v) top = { v, u: r.u };
    }
    if (top) out.push({ label, value: fmt(top.v), player: top.u });
  };
  if (gameType === "x01") {
    best("Highest turn", (pp) => pp.highestTurn);
    best("Checkout", (pp, r) => (r.isWinner ? pp.checkout : 0));
    best("Best average", (pp) => (pp.dartsThrown ? (pp.pointsScored / pp.dartsThrown) * 3 : 0), fmt1);
  } else if (gameType === "cricket") {
    best("Best MPR", (pp) => (pp.mpr != null ? pp.mpr : pp.rounds ? pp.marks / pp.rounds : 0), fmt2);
    if ((config && config.variant) !== "noscore") best("Most points", (pp) => pp.pointsScored);
    best("Best round", (pp, r) => metric(r.u, "bestRound"), (v) => `${v} marks`);
  } else if (gameType === "shanghai") {
    for (const r of rows) if ((perPlayer[r.u] || {}).shanghai) out.push({ label: "Shanghai!", value: "instant win", player: r.u });
    best("Best round", (pp) => (Array.isArray(pp.roundScores) && pp.roundScores.length ? Math.max(...pp.roundScores) : 0));
  } else if (gameType === "gotcha") {
    best("Most resets dealt", (pp) => pp.resetsDealt);
  } else if (gameType === "aroundTheClock") {
    best("Best hit rate", (pp, r) => metric(r.u, "hitRate"), (v) => `${Math.round(v)}%`);
  } else if (gameType === "halveit") {
    best("Best round", (pp, r) => metric(r.u, "bestRound"));
  } else if (gameType === "baseball") {
    best("Most runs", (pp) => pp.runs);
    best("Biggest inning", (pp, r) => metric(r.u, "biggestInning"));
  } else if (gameType === "bobs27") {
    best("Most doubles", (pp) => pp.doublesHit);
  } else if (gameType === "checkoutDrill") {
    best("Highest checkout", (pp) => pp.highestCheckout);
  } else if (gameType === "scoringDrill") {
    best("Best visit", (pp) => pp.bestVisit);
    best("Most trebles", (pp) => pp.trebles);
  }
  return out;
}

/**
 * @param match      the object a play screen passes to onFinish
 * @param game       the live game (for startedAt); optional
 * @param eloBefore  {username: elo} before the game, or null for practice
 *                   (solo, vs a bot, or a drill — see lib/practice.js)
 * @param eloAfter   {username: elo} after applyEloUpdate, or null
 * @param colors     {username: hex} avatar colors; optional
 * @param meta       {username: { tag, tagIcon }} name tags; optional
 */
export function buildSummary({ match, game, eloBefore, eloAfter, colors, meta }) {
  const { gameType, config = {}, players, winner, perPlayer = {}, completedAt } = match;
  const ranked = isRankedMatch(match);

  const rows = players.map((u) => {
    const pp = perPlayer[u] || {};
    const isWinner = u === winner;
    const d = describe(gameType, config, pp, isWinner);
    let elo = null;
    if (ranked && eloBefore && eloAfter && eloAfter[u] != null) {
      const before = Math.round(eloBefore[u] != null ? eloBefore[u] : 1000);
      const after = Math.round(eloAfter[u]);
      elo = { before, after, delta: after - before };
    }
    return {
      u,
      name: playerLabel(u),
      color: (colors && colors[u]) || null,
      tag: (meta && meta[u] && meta[u].tag) || null,
      tagIcon: (meta && meta[u] && meta[u].tagIcon) || null,
      isWinner,
      primary: d.primary,
      stats: d.stats,
      elo,
      _score: d.score,
      _lower: !!d.lowerIsBetter,
    };
  });

  rows.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    const dir = a._lower ? 1 : -1;
    return (a._score - b._score) * dir;
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
    delete r._score;
    delete r._lower;
  });

  const totalDarts = players.reduce((n, u) => n + dartsThrown(perPlayer[u] || {}), 0);
  let durationMin = null;
  if (game && game.startedAt && completedAt) {
    const ms = new Date(completedAt).getTime() - new Date(game.startedAt).getTime();
    if (ms > 0 && Number.isFinite(ms)) durationMin = Math.max(1, Math.round(ms / 60000));
  }

  return {
    gameType,
    title: gameTitle(gameType, config),
    winner,
    ranked,
    completedAt,
    durationMin,
    totalDarts,
    rows,
    highlights: highlightsFor(gameType, config, rows, perPlayer),
  };
}
