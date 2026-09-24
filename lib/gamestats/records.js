import { analyzeGame } from "./index.js";

/**
 * League records across every game type, from per-game analyses.
 * Returns [{ id, gameType, title, value, holder, date, detail }] in a
 * fixed display order, only for categories that have a holder. Pure.
 */
const CATS = [
  // x01
  { id: "x01_high_turn", gameType: "x01", title: "Highest Turn", pick: (a) => a.metrics.highestTurn, fmt: (v) => v },
  { id: "x01_high_checkout", gameType: "x01", title: "Highest Checkout", pick: (a) => (a.won ? a.metrics.checkout : 0), fmt: (v) => v },
  { id: "x01_best_leg", gameType: "x01", title: "Best Leg (Fewest Darts)", pick: (a) => a.metrics.bestLeg, lower: true, fmt: (v) => `${v}d` },
  { id: "x01_best_avg", gameType: "x01", title: "Best 3-Dart Average (Game)", pick: (a) => (a.totals.dartsThrown >= 9 ? a.metrics.threeDartAvg : 0), fmt: (v) => v.toFixed(1) },
  { id: "x01_best_first9", gameType: "x01", title: "Best First 9", pick: (a) => a.metrics.first9Avg, fmt: (v) => v.toFixed(1) },
  { id: "x01_most_180s", gameType: "x01", title: "Most 180s (Game)", pick: (a) => a.metrics.one80s, fmt: (v) => v },
  // cricket
  { id: "cricket_best_mpr", gameType: "cricket", title: "Best MPR Game", pick: (a) => (a.totals.rounds >= 3 ? a.metrics.mpr : 0), fmt: (v) => v.toFixed(2) },
  { id: "cricket_best_round", gameType: "cricket", title: "Most Marks in a Round", pick: (a) => a.metrics.bestRound, fmt: (v) => v },
  { id: "cricket_fastest_close", gameType: "cricket", title: "Fastest Cricket Win (Rounds)", pick: (a) => (a.won ? a.totals.rounds : 0), lower: true, fmt: (v) => `${v} rounds` },
  // baseball
  { id: "baseball_most_runs", gameType: "baseball", title: "Most Runs (Baseball)", pick: (a) => a.metrics.runs, fmt: (v) => v },
  { id: "baseball_biggest_inning", gameType: "baseball", title: "Biggest Inning", pick: (a) => a.metrics.biggestInning, fmt: (v) => v },
  // clock
  { id: "clock_fewest_darts", gameType: "aroundTheClock", title: "Fewest Darts Around the Clock", pick: (a) => (a.metrics.finished ? a.metrics.dartsToFinish : 0), lower: true, fmt: (v) => `${v}d` },
  // killer
  { id: "killer_fastest", gameType: "killer", title: "Fastest Killer (Darts)", pick: (a) => a.metrics.dartsToBecomeKiller, lower: true, fmt: (v) => `${v}d` },
  { id: "killer_most_kills", gameType: "killer", title: "Most Kills (Game)", pick: (a) => a.metrics.kills, fmt: (v) => v },
  // shanghai
  { id: "shanghai_high_game", gameType: "shanghai", title: "Highest Shanghai Game", pick: (a) => a.metrics.totalScore, fmt: (v) => v },
  { id: "shanghai_high_round", gameType: "shanghai", title: "Highest Shanghai Round", pick: (a) => a.metrics.bestRound, fmt: (v) => v },
  // halve it
  { id: "halveit_high", gameType: "halveit", title: "Highest Halve It Score", pick: (a) => a.metrics.finalScore, fmt: (v) => v },
  { id: "halveit_fewest_halves", gameType: "halveit", title: "Fewest Halvings (Game)", pick: (a) => (a.metrics.halves == null ? null : a.metrics.halves + 1), lower: true, fmt: (v) => `${v - 1}×` },
  // gotcha
  { id: "gotcha_fewest_darts", gameType: "gotcha", title: "Fastest Gotcha (Darts)", pick: (a) => a.metrics.dartsToTarget, lower: true, fmt: (v) => `${v}d` },
  { id: "gotcha_most_resets", gameType: "gotcha", title: "Most Resets Dealt (Game)", pick: (a) => a.metrics.resetsDealt, fmt: (v) => v },
  // tic-tac-toe
  { id: "ttt_fewest_darts", gameType: "tictactoe", title: "Fastest Tic-Tac-Toe Win", pick: (a) => (a.won ? a.totals.dartsThrown : 0), lower: true, fmt: (v) => `${v}d` },
  // drills (practice rows)
  { id: "bobs27_high", gameType: "bobs27", title: "Bob's 27 High Score", practice: true, pick: (a) => a.metrics.finalScore, fmt: (v) => v },
  { id: "checkout_best_rate", gameType: "checkoutDrill", title: "Checkout Drill Best Hit Rate", practice: true, pick: (a) => ((a.metrics.finishes || 0) >= 5 ? a.metrics.hitRate : 0), fmt: (v) => `${Math.round(v)}%` },
  { id: "scoring_best_visit", gameType: "scoringDrill", title: "Scoring Drill Best Visit", practice: true, pick: (a) => a.metrics.bestVisit, fmt: (v) => v },
];

export function computeRecords({ results, practice }) {
  const best = {};
  const consider = (rows, isPractice) => {
    for (const r of rows || []) {
      const cats = CATS.filter((c) => c.gameType === r.gameType && !!c.practice === isPractice);
      if (!cats.length) continue;
      const a = analyzeGame(r);
      for (const c of cats) {
        const v = c.pick(a);
        if (v == null || !Number.isFinite(v) || v <= 0) continue;
        const cur = best[c.id];
        const better = !cur || (c.lower ? v < cur.value : v > cur.value);
        if (better) best[c.id] = { id: c.id, gameType: c.gameType, title: c.title, value: v, display: c.fmt(v), holder: r.username, date: r.completedAt, gameId: r.gameId };
      }
    }
  };
  consider(results, false);
  consider(practice, true);
  return CATS.map((c) => best[c.id]).filter(Boolean);
}
