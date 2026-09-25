import { gameName } from "./summary.js";
import { playerLabel } from "./bots.js";

/**
 * Home's "Play Again": the signed-in player's most recent finished game
 * (ranked or practice), rebuilt as a startable game. Only the players,
 * mode and settings are reused; the caller runs it through rematchGame()
 * for a fresh id (and fresh Killer numbers). Pure.
 */
export function lastGameFor(rows, me) {
  let last = null;
  for (const r of rows || []) {
    if (r.username !== me || !r.gameType) continue;
    if (!last || new Date(r.completedAt) > new Date(last.completedAt)) last = r;
  }
  if (!last) return null;
  const players = [me, ...(last.opponents || []).filter((o) => o && o !== me)];
  return { id: "", gameType: last.gameType, config: { ...(last.config || {}) }, players };
}

/** "Baseball vs Chuck", "X01 vs Chuck +1", "Checkout Drill". */
export function playAgainLabel(game) {
  if (!game) return "";
  const name = gameName(game.gameType);
  const others = (game.players || []).slice(1);
  if (!others.length) return name;
  const first = playerLabel(others[0]);
  return `${name} vs ${first}${others.length > 1 ? ` +${others.length - 1}` : ""}`;
}

/** Current run of wins or losses from a player's lastFive, e.g. "W3", "L2". */
export function currentStreak(lastFive) {
  const l = lastFive || [];
  if (!l.length) return null;
  const tail = l[l.length - 1];
  let n = 0;
  for (let i = l.length - 1; i >= 0 && l[i] === tail; i--) n++;
  return `${tail}${n}`;
}
