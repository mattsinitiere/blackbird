import { BASE_ELO } from "./constants.js";
import { describe, gameTitle } from "./summary.js";
import { analyzeGame } from "./gamestats/index.js";
import { rivalry } from "./stats.js";
import { isBot } from "./bots.js";

/**
 * The profile's activity feed and circle, derived from rows the app
 * already holds. Matches are the player's own ranked rows (practice, bot
 * games and drills stay in the practice log); achievements appear on the
 * date the game or follow that earned them happened. Pure.
 */

const ms = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Up to three stand-out numbers from one game, only when they were logged. */
export function matchHighlights(row) {
  let m = {};
  try {
    m = analyzeGame(row)?.metrics || {};
  } catch {
    m = {};
  }
  const pp = row.stats || {};
  const out = [];
  const add = (label, value) => out.length < 3 && out.push({ label, value });
  switch (row.gameType) {
    case "x01":
      if (m.one80s > 0) add("180s", m.one80s);
      if (row.winner === row.username && (m.checkout || pp.checkout) >= 100) add("Ton-plus finish", m.checkout || pp.checkout);
      if ((m.highestTurn || pp.highestTurn) >= 100) add("High turn", m.highestTurn || pp.highestTurn);
      if (m.bestLeg && row.winner === row.username) add("Best leg", `${m.bestLeg} darts`);
      break;
    case "cricket":
      if (m.bestRound >= 6) add("Best round", `${m.bestRound} marks`);
      if (m.mpr >= 3) add("MPR", m.mpr.toFixed(2));
      break;
    case "baseball":
      if (m.biggestInning >= 5) add("Big inning", `${m.biggestInning} runs`);
      break;
    case "shanghai":
      if (pp.shanghai || m.shanghai) add("Shanghai", "hit");
      break;
    default:
      break;
  }
  return out;
}

/**
 * The player's ranked matches, newest first. Each carries the game title,
 * opponents, result (a multiplayer loss names who won), this player's
 * headline figures for that mode and the Elo change.
 */
export function matchFeed(results, user) {
  const rows = (results || [])
    .filter((r) => r.username === user && r.result !== "practice")
    .sort((a, b) => ms(a.completedAt) - ms(b.completedAt));
  let prevElo = BASE_ELO;
  const items = rows.map((row, i) => {
    const won = row.winner === user;
    const d = describe(row.gameType, row.config || {}, row.stats || {}, won);
    const eloAfter = row.eloAfter == null ? null : Math.round(row.eloAfter);
    const eloDelta = eloAfter == null ? null : eloAfter - Math.round(prevElo);
    if (eloAfter != null) prevElo = eloAfter;
    const opponents = row.opponents || [];
    const place = Number.isFinite(row.stats?.place) ? row.stats.place : won ? 1 : null;
    return {
      kind: "match",
      key: `m:${row.gameId || i}:${user}`,
      date: row.completedAt,
      row,
      gameType: row.gameType,
      title: gameTitle(row.gameType, row.config || {}),
      opponents,
      players: opponents.length + 1,
      won,
      winner: row.winner,
      place,
      // older rows lack some fields: never show a zero that was simply not logged
      primary: d.primary && d.primary.label && !(d.primary.label === "legs" && row.stats?.legsWon == null) ? d.primary : null,
      figures: (d.stats || []).filter((s) => s.value !== "" && s.value != null && !(s.label === "darts" && !s.value)).slice(0, 3),
      eloAfter,
      eloDelta,
      highlights: matchHighlights(row),
    };
  });
  return items.reverse();
}

/** Unlocked badges as feed items on the date they were earned. */
export function achievementFeed(badges) {
  return (badges || [])
    .filter((b) => b.unlocked && b.earnedAt)
    .map((b) => ({ kind: "achievement", key: `a:${b.id}`, date: b.earnedAt, badge: b }))
    .sort((a, b) => ms(b.date) - ms(a.date));
}

/** Newest first; on the same moment the match comes before what it unlocked. */
export function mergeFeed(matches, achievements) {
  return [...(matches || []), ...(achievements || [])].sort((a, b) => ms(b.date) - ms(a.date) || (a.kind === "match" ? -1 : 1));
}

/**
 * The people shown in the profile sidebar, each with the ranked record
 * between them and `user` (from `user`'s own rows, so it is exact for the
 * rows we can see). My profile: the players I follow. Someone else's:
 * the opponents they have played most (their follows are private).
 */
export function circleFor({ user, isMe, results, following = null }) {
  let names;
  if (isMe) {
    names = (following || []).map((f) => (typeof f === "string" ? f : f.username));
  } else {
    names = [...new Set((results || []).filter((r) => r.username === user && r.result !== "practice").flatMap((r) => r.opponents || []))];
  }
  return names
    .filter((u) => u && u !== user && !isBot(u))
    .map((u) => {
      const r = rivalry(results, user, u);
      return { username: u, games: r.games, wins: r.wins, losses: r.losses, otherWinner: r.otherWinner, lastPlayed: r.lastPlayed };
    })
    .filter((c) => isMe || c.games > 0)
    .sort((a, b) => b.games - a.games || ms(b.lastPlayed) - ms(a.lastPlayed) || a.username.localeCompare(b.username));
}
