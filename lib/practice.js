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

/** A game_results row (snake_case, as the database returns it) in the in-memory shape. */
export function resultFromRow(r, baseElo = 1000) {
  return {
    id: r.id ?? null,
    gameId: r.game_id,
    username: r.username,
    gameType: r.game_type,
    config: r.config || {},
    winner: r.winner,
    result: r.result,
    opponents: r.opponents || [],
    stats: r.stats || {},
    eloAfter: r.elo_after == null ? baseElo : Number(r.elo_after),
    completedAt: r.completed_at,
  };
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
 * current Elo unchanged so Elo timelines stay continuous. `places`
 * ({ username: place }, optional) is stored as `stats.place`.
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
  places = null,
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
      stats: places && places[u] != null ? { ...((perPlayer && perPlayer[u]) || {}), place: places[u] } : (perPlayer && perPlayer[u]) || {},
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

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const DRILL_METRIC = {
  // what each drill's trend and personal best are measured in
  bobs27: { label: "score", value: (pp) => pp.finalScore || 0 },
  checkoutDrill: { label: "hit", value: (pp) => pp.hit || 0, tiebreak: (pp) => -(pp.dartsPerHit || 0) },
  scoringDrill: { label: "per visit", value: (pp) => pp.avgPerTurn || 0 },
};

/**
 * Everything the practice hub and the profile's practice section show for
 * one player, from their practice rows: session counts, a weekly series,
 * per-drill personal bests and trends, the solo X01 average trend, the
 * bot ladder and the most recent sessions. `now` is injectable for tests.
 */
export function computePractice(practiceRows, me, now = new Date()) {
  const mine = (practiceRows || [])
    .filter((r) => r.username === me)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));

  const weekAgo = now.getTime() - WEEK_MS;
  const thisWeek = mine.filter((r) => new Date(r.completedAt).getTime() > weekAgo).length;

  const drills = {};
  for (const [type, m] of Object.entries(DRILL_METRIC)) {
    const rows = mine.filter((r) => r.gameType === type);
    let pb = null;
    const series = rows.map((r, i) => {
      const pp = r.stats || {};
      const v = m.value(pp);
      const better =
        !pb || v > pb.value || (v === pb.value && m.tiebreak && m.tiebreak(pp) > m.tiebreak(pb.stats));
      if (better) pb = { value: v, stats: pp, date: r.completedAt };
      return { x: i + 1, y: Math.round(v * 10) / 10, date: r.completedAt };
    });
    drills[type] = { count: rows.length, label: m.label, pb, last: rows[rows.length - 1] || null, series };
  }

  const soloX01 = mine.filter((r) => r.gameType === "x01" && r.stats && r.stats.dartsThrown);
  let bestAvg = 0;
  const x01Series = soloX01.map((r, i) => {
    const avg = (r.stats.pointsScored / r.stats.dartsThrown) * 3;
    bestAvg = Math.max(bestAvg, avg);
    return { x: i + 1, y: Math.round(avg * 10) / 10, date: r.completedAt };
  });

  const ladder = botLadder(mine, me);
  const botGames = mine.filter((r) => (r.opponents || []).some(isBot));
  const level = ladder.filter((l) => l.unlocked).length;

  return {
    count: mine.length,
    thisWeek,
    drills,
    x01: { count: soloX01.length, bestAvg: Math.round(bestAvg * 10) / 10, series: x01Series },
    bots: { games: botGames.length, wins: botGames.filter((r) => r.winner === me).length, ladder, level },
    recent: mine.slice(-8).reverse(),
  };
}
