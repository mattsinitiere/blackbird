import { computeStats, playerTimeline } from "./stats.js";
import { computeCareer } from "./gamestats/career.js";
import { PRACTICE_ONLY } from "./practice.js";
import { isBot } from "./bots.js";

/**
 * Practice shown the way ranked play is shown. A player's practice games
 * (bot games and solo games, not drills) are recast as match rows so the
 * very same stat code that builds the ranked Statistics tab runs over
 * them: headline tiles, trend charts, career cards per game mode, streaks.
 * Nothing here feeds Elo, the leaderboard or the ranked numbers; it is a
 * second, separate view over rows that were always saved. Pure.
 */

/**
 * One player's practice games as match rows. A game with an opponent (a
 * bot) is a "win" or a "loss". A solo game has nobody to beat, so it is
 * "solo": it counts toward games and averages, never toward the record.
 * Drills are left out; they have their own cards.
 */
export function practiceAsMatches(practiceRows, me) {
  return (practiceRows || [])
    .filter((r) => r.username === me && r.result === "practice" && !PRACTICE_ONLY.has(r.gameType))
    .map((r) => ({ ...r, result: (r.opponents || []).length ? (r.winner === me ? "win" : "loss") : "solo" }));
}

/**
 * Everything the profile's Practice statistics view shows for one player,
 * or null when they have no practice rows at all.
 *
 *  - `stats`: the shape lib/stats computeStats returns for a player, where
 *    `games`, `wins`, `winPct`, the streaks and `lastFive` cover only games
 *    against an opponent; `played` is every practice game, solo included,
 *    and the per-mode averages (3-dart average, MPR, runs) use them all.
 *    Null when there are only drills.
 *  - `timeline`: { avg, mpr, win } chart series (win % is against opponents).
 *  - `career`: per-mode career numbers (lib/gamestats/career), drills too.
 *  - `bots`: record against each bot played, most games first.
 */
export function computePracticeStats(practiceRows, me) {
  const mine = (practiceRows || []).filter((r) => r.username === me && r.result === "practice");
  if (!mine.length) return null;
  const rows = practiceAsMatches(mine, me);
  const versus = rows.filter((r) => r.result !== "solo");
  const drills = mine.length - rows.length;
  const career = computeCareer({ results: rows, practice: mine }, me);

  let stats = null;
  let timeline = { avg: [], mpr: [], win: [] };
  if (rows.length) {
    const all = computeStats(rows)[me];
    const vs = computeStats(versus)[me] || { games: 0, wins: 0, winPct: 0, winStreak: 0, bestWinStreak: 0, lastFive: [] };
    stats = {
      ...all,
      played: all.games,
      solo: rows.length - versus.length,
      games: vs.games,
      wins: vs.wins,
      winPct: vs.winPct,
      winStreak: vs.winStreak,
      bestWinStreak: vs.bestWinStreak,
      lastFive: vs.lastFive,
    };
    delete stats.eloChange; // practice never moves Elo
    const tAll = playerTimeline(rows, me);
    timeline = { avg: tAll.avg, mpr: tAll.mpr, win: playerTimeline(versus, me).win };
  }

  const byBot = new Map();
  for (const r of versus) {
    const bot = (r.opponents || []).find(isBot);
    if (!bot) continue;
    const rec = byBot.get(bot) || { bot, games: 0, wins: 0, losses: 0 };
    rec.games++;
    if (r.result === "win") rec.wins++;
    else rec.losses++;
    byBot.set(bot, rec);
  }
  const bots = [...byBot.values()].sort((a, b) => b.games - a.games || b.wins - a.wins);

  return { stats, timeline, career, bots, games: rows.length, drills };
}

/** How many of a player's practice rows are games, and how many are drills. */
export function practiceCounts(practiceRows, me) {
  let games = 0;
  let drills = 0;
  for (const r of practiceRows || []) {
    if (r.username !== me || r.result !== "practice") continue;
    if (PRACTICE_ONLY.has(r.gameType)) drills++;
    else games++;
  }
  return { games, drills };
}
