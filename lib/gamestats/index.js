import { analyzeX01 } from "./x01.js";
import { analyzeCricket } from "./cricket.js";
import { analyzeBaseball } from "./baseball.js";
import { analyzeClock } from "./clock.js";
import { analyzeKiller } from "./killer.js";
import { analyzeShanghai } from "./shanghai.js";
import { analyzeHalveIt } from "./halveit.js";
import { analyzeGotcha } from "./gotcha.js";
import { analyzeTicTacToe } from "./tictactoe.js";
import { analyzeBobs27, analyzeCheckoutDrill, analyzeScoringDrill } from "./drills.js";
import { baseAnalysis, quality } from "./common.js";

/**
 * The stats engine entry point. Every consumer (career stats, summaries,
 * records, the match report, the AI coach) reads game data through here,
 * never from the raw `stats` JSONB, so per-game quirks and legacy rows are
 * handled in exactly one place.
 */
const ANALYZERS = {
  x01: analyzeX01,
  cricket: analyzeCricket,
  baseball: analyzeBaseball,
  aroundTheClock: analyzeClock,
  killer: analyzeKiller,
  shanghai: analyzeShanghai,
  halveit: analyzeHalveIt,
  gotcha: analyzeGotcha,
  tictactoe: analyzeTicTacToe,
  bobs27: analyzeBobs27,
  checkoutDrill: analyzeCheckoutDrill,
  scoringDrill: analyzeScoringDrill,
};

export function registerAnalyzer(gameType, fn) {
  ANALYZERS[gameType] = fn;
}

export function hasAnalyzer(gameType) {
  return !!ANALYZERS[gameType];
}

/** One player's performance in one game. */
export function analyzePerformance(gameType, config, pp, { username, winner } = {}) {
  const fn = ANALYZERS[gameType];
  if (fn) return fn(pp || {}, config || {}, { username, winner });
  return baseAnalysis({
    gameType,
    pp,
    username,
    winner,
    quality: quality({ legacy: !(pp && pp.v >= 2), hasVisits: false, notes: ["no analyzer for this game type yet"] }),
    visits: [],
    rounds: [],
    totals: { dartsThrown: pp?.dartsThrown || (Array.isArray(pp?.darts) ? pp.darts.length : 0) },
    perDart: {},
    metrics: {},
    seriesOut: {},
  });
}

/** One game_results row (camelCase, as lib/db.js returns them). */
export function analyzeGame(row) {
  return analyzePerformance(row.gameType, row.config, row.stats, { username: row.username, winner: row.winner });
}

/** All rows of one game (one per human player) → per-player analyzes. */
export function analyzeMatch(rows) {
  const list = (rows || []).filter(Boolean);
  const first = list[0];
  if (!first) return null;
  const players = {};
  for (const r of list) players[r.username] = analyzeGame(r);
  return { gameId: first.gameId, gameType: first.gameType, config: first.config, winner: first.winner, completedAt: first.completedAt, players };
}

/**
 * Rows for a just-finished match, in the same camelCase shape as saved
 * rows, so the match report works before the save lands.
 */
export function rowsFromMatch(match) {
  const players = (match?.players || []).filter((u) => !String(u).startsWith("bot:"));
  return players.map((u) => ({
    id: null,
    gameId: match.gameId || match.id,
    username: u,
    gameType: match.gameType,
    config: match.config || {},
    winner: match.winner,
    result: match.winner === u ? "win" : "loss",
    opponents: (match.players || []).filter((p) => p !== u),
    stats: (match.perPlayer && match.perPlayer[u]) || {},
    eloAfter: null,
    completedAt: match.completedAt,
  }));
}
