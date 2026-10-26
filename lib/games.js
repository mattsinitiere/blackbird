/** Game-setup helpers shared by the New Game screen and Rematch. */

export const KILLER_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Give each player a distinct random number 1–20. */
export function assignKillerNumbers(players) {
  const pool = [...KILLER_NUMBERS];
  const out = {};
  for (const p of players) {
    const idx = Math.floor(Math.random() * pool.length);
    out[p] = pool.splice(idx, 1)[0];
  }
  return out;
}

export function newGameId() {
  return Date.now().toString(36);
}

/**
 * Same players, same rules, fresh game. Killer re-draws its numbers so a
 * rematch isn't a replay of the same targets. With rotate, the throw order
 * moves on by one so the starting throw alternates game to game.
 */
export function rematchGame(game, { rotate = false } = {}) {
  const players = rotate && game.players?.length > 1 ? [...game.players.slice(1), game.players[0]] : game.players;
  const config = { ...(game.config || {}) };
  if (game.gameType === "killer") config.numbers = assignKillerNumbers(players);
  return { ...game, players, id: newGameId(), config, startedAt: new Date().toISOString() };
}
