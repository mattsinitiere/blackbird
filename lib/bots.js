/**
 * Bot opponents. A bot is a player id with a reserved prefix, so it flows
 * through game.players, perPlayer, turn order and the TV cast untouched;
 * only name rendering and persistence treat it specially (bots never get
 * a game_results row and never touch Elo).
 *
 * The roster itself (levels, accuracy, strategy) lands with the ladder.
 * Pure: no React, no network.
 */

export const BOT_PREFIX = "bot:";

export function isBot(u) {
  return typeof u === "string" && u.startsWith(BOT_PREFIX);
}

/** Display name for a player id: bots get their name, humans pass through. */
export function playerLabel(u) {
  if (!isBot(u)) return u;
  const slug = u.slice(BOT_PREFIX.length);
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
