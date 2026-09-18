import { isBot, BOTS } from "./bots.js";

/**
 * Practice vs ranked. One rule, used by the shell (what to save), the
 * summary (whether to show Elo) and the data layer (what rows to write).
 *
 * A game is ranked only when two or more real players face each other in
 * a competitive game type. Solo games, games against a bot and drills are
 * practice: they are saved with result = 'practice', never touch Elo,
 * averages or the leaderboard, and feed the practice log instead.
 * Pure: no React, no network.
 */

/** Game types that are always practice, whoever plays them. */
export const PRACTICE_ONLY = new Set(["bobs27", "checkoutDrill", "scoringDrill"]);

export function humanPlayers(players) {
  return (players || []).filter((u) => !isBot(u));
}

export function isRankedMatch({ gameType, players } = {}) {
  if (!players || players.length < 2) return false;
  if (players.some(isBot)) return false;
  if (PRACTICE_ONLY.has(gameType)) return false;
  return true;
}

export function isPracticeRow(r) {
  return r && r.result === "practice";
}

/** Split fetched rows into competitive and practice lists, order preserved. */
export function splitResults(rows) {
  const competitive = [];
  const practice = [];
  for (const r of rows || []) (isPracticeRow(r) ? practice : competitive).push(r);
  return { competitive, practice };
}

/**
 * Shape the game_results rows for one finished game. Only real players get
 * a row. Ranked rows carry the new Elo; practice rows carry the player's
 * current Elo unchanged so Elo timelines stay continuous.
 */
export function buildResultRows({
  gameId,
  gameType,
  config,
  players,
  winner,
  perPlayer,
  ranked,
  eloAfter,
  currentElo,
  completedAt,
  baseElo = 1000,
}) {
  return humanPlayers(players).map((u) => {
    const elo = ranked ? eloAfter[u] : currentElo && currentElo[u] != null ? currentElo[u] : baseElo;
    return {
      game_id: gameId,
      username: u,
      game_type: gameType,
      config: config || {},
      winner,
      result: ranked ? (u === winner ? "win" : "loss") : "practice",
      opponents: players.filter((p) => p !== u),
      stats: (perPlayer && perPlayer[u]) || {},
      elo_after: Math.round(elo),
      completed_at: completedAt,
    };
  });
}

/**
 * The bot ladder for one player, from their practice rows: per-bot record
 * and whether the bot is unlocked. Level 1 is always open; each later bot
 * opens once the one below it has been beaten (in any bot game).
 */
export function botLadder(practiceRows, me) {
  const record = {};
  for (const b of BOTS) record[b.id] = { wins: 0, losses: 0 };
  for (const r of practiceRows || []) {
    if (r.username !== me) continue;
    const opp = (r.opponents || []).find((o) => record[o]);
    if (!opp) continue;
    if (r.winner === me) record[opp].wins++;
    else record[opp].losses++;
  }
  return BOTS.map((bot, i) => ({
    bot,
    ...record[bot.id],
    unlocked: i === 0 || record[BOTS[i - 1].id].wins > 0,
  }));
}
